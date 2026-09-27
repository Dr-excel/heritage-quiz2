import { Hono } from "hono";
import type {
  AnswerResult,
  CourseId,
  ImageInfo,
  QuestionView,
  RankingEntry,
  ResultView,
  SessionState,
} from "../src/lib/types";
import { COURSE_IDS, QUESTIONS_PER_QUIZ } from "../src/lib/types";
import { validateNickname } from "./nickname";

type Env = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  API_LIMITER?: RateLimit;
};

type SessionRow = {
  id: string;
  course_id: CourseId;
  question_ids: string;
  answered_count: number;
  correct_count: number;
  started_at: number;
  finished_at: number | null;
  ranked: number;
};

type ImageRow = {
  r2_key: string;
  width: number;
  height: number;
  alt_text: string;
  credit: string;
  license: string;
  license_url: string | null;
  source_url: string;
};

const SESSION_ID_RE = /^[0-9a-f-]{36}$/;
const SESSION_TTL_MS = 2 * 24 * 60 * 60 * 1000;

const app = new Hono<{ Bindings: Env }>();

// ---- 共通処理 ----

// API 全体に IP 単位のレート制限をかける（binding が無い環境ではスキップ）
app.use("/api/*", async (c, next) => {
  if (c.env.API_LIMITER) {
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    const { success } = await c.env.API_LIMITER.limit({ key: ip });
    if (!success) return c.json({ error: "アクセスが集中しています。しばらく待ってから再度お試しください。" }, 429);
  }
  await next();
  c.header("Cache-Control", "no-store");
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "サーバーでエラーが発生しました。" }, 500);
});

function isCourseId(v: unknown): v is CourseId {
  return typeof v === "string" && (COURSE_IDS as readonly string[]).includes(v);
}

function toImageInfo(row: ImageRow | null): ImageInfo | null {
  if (!row) return null;
  return {
    url: `/img/${row.r2_key}`,
    width: row.width,
    height: row.height,
    alt: row.alt_text,
    credit: row.credit,
    license: row.license,
    licenseUrl: row.license_url,
    sourceUrl: row.source_url,
  };
}

async function getImage(db: D1Database, id: number | null): Promise<ImageInfo | null> {
  if (id == null) return null;
  const row = await db.prepare("SELECT * FROM images WHERE id = ?").bind(id).first<ImageRow>();
  return toImageInfo(row);
}

async function getSession(db: D1Database, id: string): Promise<SessionRow | null> {
  if (!SESSION_ID_RE.test(id)) return null;
  return db.prepare("SELECT * FROM quiz_sessions WHERE id = ?").bind(id).first<SessionRow>();
}

function toSessionState(s: SessionRow): SessionState {
  const total = (JSON.parse(s.question_ids) as number[]).length;
  return {
    sessionId: s.id,
    courseId: s.course_id,
    total,
    answeredCount: s.answered_count,
    correctCount: s.correct_count,
    finished: s.finished_at != null,
  };
}

// 選択肢の並びは毎回サーバー側でシャッフルする
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildAnswerResult(
  db: D1Database,
  session: SessionRow,
  position: number,
  questionId: number,
  choiceId: number,
): Promise<AnswerResult> {
  const q = await db
    .prepare("SELECT explanation, explanation_image_id FROM questions WHERE id = ?")
    .bind(questionId)
    .first<{ explanation: string; explanation_image_id: number | null }>();
  const correct = await db
    .prepare("SELECT id FROM choices WHERE question_id = ? AND is_correct = 1")
    .bind(questionId)
    .first<{ id: number }>();
  return {
    position,
    correct: correct?.id === choiceId,
    choiceId,
    correctChoiceId: correct?.id ?? -1,
    explanation: q?.explanation ?? "",
    explanationImage: await getImage(db, q?.explanation_image_id ?? null),
    correctCount: session.correct_count,
    finished: session.finished_at != null,
  };
}

// ---- セッション ----

// コースを指定してクイズを開始する（公開中の問題から10問をランダムに選ぶ）
app.post("/api/sessions", async (c) => {
  const body = await c.req.json<{ courseId?: unknown }>().catch(() => ({}) as { courseId?: unknown });
  if (!isCourseId(body.courseId)) return c.json({ error: "コースが正しくありません。" }, 400);

  const { results } = await c.env.DB.prepare(
    "SELECT id FROM questions WHERE course_id = ? AND status = 'published' ORDER BY RANDOM() LIMIT ?",
  )
    .bind(body.courseId, QUESTIONS_PER_QUIZ)
    .all<{ id: number }>();
  if (results.length < QUESTIONS_PER_QUIZ) {
    return c.json({ error: "このコースの問題がまだ準備できていません。" }, 503);
  }

  const id = crypto.randomUUID();
  const ids = results.map((r) => r.id);
  await c.env.DB.prepare(
    "INSERT INTO quiz_sessions (id, course_id, question_ids, started_at) VALUES (?, ?, ?, ?)",
  )
    .bind(id, body.courseId, JSON.stringify(ids), Date.now())
    .run();

  const state: SessionState = {
    sessionId: id,
    courseId: body.courseId,
    total: ids.length,
    answeredCount: 0,
    correctCount: 0,
    finished: false,
  };
  return c.json(state, 201);
});

app.get("/api/sessions/:id", async (c) => {
  const s = await getSession(c.env.DB, c.req.param("id"));
  if (!s) return c.json({ error: "セッションが見つかりません。" }, 404);
  return c.json(toSessionState(s));
});

// n 問目を取得する。正解は含めない（回答済みの問題だけ結果も返す）
app.get("/api/sessions/:id/questions/:position", async (c) => {
  const db = c.env.DB;
  const s = await getSession(db, c.req.param("id"));
  if (!s) return c.json({ error: "セッションが見つかりません。" }, 404);

  const ids = JSON.parse(s.question_ids) as number[];
  const position = Number(c.req.param("position"));
  if (!Number.isInteger(position) || position < 1 || position > ids.length) {
    return c.json({ error: "問題番号が正しくありません。" }, 400);
  }
  // まだ順番が来ていない問題は見せない
  if (position > s.answered_count + 1) return c.json({ error: "前の問題に先に回答してください。" }, 409);

  const questionId = ids[position - 1];
  const q = await db
    .prepare("SELECT body, image_id FROM questions WHERE id = ?")
    .bind(questionId)
    .first<{ body: string; image_id: number | null }>();
  if (!q) return c.json({ error: "問題が見つかりません。" }, 404);

  const { results: choices } = await db
    .prepare("SELECT id, body FROM choices WHERE question_id = ? ORDER BY sort_order")
    .bind(questionId)
    .all<{ id: number; body: string }>();

  let answered: AnswerResult | null = null;
  const prev = await db
    .prepare("SELECT choice_id FROM quiz_answers WHERE session_id = ? AND position = ?")
    .bind(s.id, position)
    .first<{ choice_id: number }>();
  if (prev) answered = await buildAnswerResult(db, s, position, questionId, prev.choice_id);

  const image = await getImage(db, q.image_id);
  const view: QuestionView = {
    position,
    total: ids.length,
    body: q.body,
    image,
    choices: shuffle(choices),
    answered,
  };
  return c.json(view);
});

// 回答する。判定はサーバー側で行い、正解と解説を返す
app.post("/api/sessions/:id/answers", async (c) => {
  const db = c.env.DB;
  const s = await getSession(db, c.req.param("id"));
  if (!s) return c.json({ error: "セッションが見つかりません。" }, 404);

  const body = await c.req
    .json<{ position?: unknown; choiceId?: unknown }>()
    .catch(() => ({}) as { position?: unknown; choiceId?: unknown });
  const position = Number(body.position);
  const choiceId = Number(body.choiceId);
  const ids = JSON.parse(s.question_ids) as number[];

  if (s.finished_at != null) return c.json({ error: "このクイズは終了しています。" }, 409);
  if (!Number.isInteger(position) || position !== s.answered_count + 1) {
    return c.json({ error: "回答する問題の順番が正しくありません。" }, 409);
  }
  const questionId = ids[position - 1];
  const choice = await db
    .prepare("SELECT id, is_correct FROM choices WHERE id = ? AND question_id = ?")
    .bind(choiceId, questionId)
    .first<{ id: number; is_correct: number }>();
  if (!choice) return c.json({ error: "選択肢が正しくありません。" }, 400);

  const now = Date.now();
  const isCorrect = choice.is_correct === 1 ? 1 : 0;
  const finishes = position === ids.length;
  try {
    // 回答の記録と集計の更新を1つのトランザクションで行う。
    // 同じ問題への二重回答は主キー違反になり、まとめて取り消される
    await db.batch([
      db
        .prepare(
          "INSERT INTO quiz_answers (session_id, position, question_id, choice_id, is_correct, answered_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(s.id, position, questionId, choiceId, isCorrect, now),
      db
        .prepare(
          "UPDATE quiz_sessions SET answered_count = answered_count + 1, correct_count = correct_count + ?, finished_at = ? WHERE id = ?",
        )
        .bind(isCorrect, finishes ? now : null, s.id),
    ]);
  } catch {
    return c.json({ error: "この問題にはすでに回答しています。" }, 409);
  }

  const updated = { ...s, correct_count: s.correct_count + isCorrect, finished_at: finishes ? now : null };
  return c.json(await buildAnswerResult(db, updated, position, questionId, choiceId));
});

// 採点結果と振り返り
app.get("/api/sessions/:id/result", async (c) => {
  const db = c.env.DB;
  const s = await getSession(db, c.req.param("id"));
  if (!s) return c.json({ error: "セッションが見つかりません。" }, 404);

  const { results } = await db
    .prepare(
      `SELECT a.position, a.is_correct, q.body,
              yc.body AS your_answer,
              (SELECT body FROM choices WHERE question_id = a.question_id AND is_correct = 1) AS correct_answer
         FROM quiz_answers a
         JOIN questions q ON q.id = a.question_id
         JOIN choices yc ON yc.id = a.choice_id
        WHERE a.session_id = ?
        ORDER BY a.position`,
    )
    .bind(s.id)
    .all<{ position: number; is_correct: number; body: string; your_answer: string; correct_answer: string }>();

  const total = (JSON.parse(s.question_ids) as number[]).length;
  const view: ResultView = {
    sessionId: s.id,
    courseId: s.course_id,
    total,
    correctCount: s.correct_count,
    accuracy: s.correct_count / total,
    elapsedMs: (s.finished_at ?? Date.now()) - s.started_at,
    finished: s.finished_at != null,
    ranked: s.ranked === 1,
    answers: results.map((r) => ({
      position: r.position,
      body: r.body,
      correct: r.is_correct === 1,
      yourAnswer: r.your_answer,
      correctAnswer: r.correct_answer,
    })),
  };
  return c.json(view);
});

// ---- ランキング ----

app.get("/api/rankings", async (c) => {
  const courseId = c.req.query("course");
  if (!isCourseId(courseId)) return c.json({ error: "コースが正しくありません。" }, 400);
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 100);

  const { results } = await c.env.DB.prepare(
    `SELECT ROW_NUMBER() OVER (ORDER BY accuracy DESC, elapsed_ms ASC, created_at ASC) AS rank,
            nickname, correct_count, total, accuracy, elapsed_ms, created_at
       FROM rankings
      WHERE course_id = ? AND is_hidden = 0
      ORDER BY rank
      LIMIT ?`,
  )
    .bind(courseId, limit)
    .all<{
      rank: number;
      nickname: string;
      correct_count: number;
      total: number;
      accuracy: number;
      elapsed_ms: number;
      created_at: number;
    }>();

  const entries: RankingEntry[] = results.map((r) => ({
    rank: r.rank,
    nickname: r.nickname,
    correctCount: r.correct_count,
    total: r.total,
    accuracy: r.accuracy,
    elapsedMs: r.elapsed_ms,
    createdAt: r.created_at,
  }));
  c.header("Cache-Control", "public, max-age=15");
  return c.json({ courseId, entries });
});

// ランキングに登録する（完了済みセッションにつき1回だけ）
app.post("/api/rankings", async (c) => {
  const db = c.env.DB;
  const body = await c.req
    .json<{ sessionId?: unknown; nickname?: unknown }>()
    .catch(() => ({}) as Record<string, unknown>);

  const nick = validateNickname(body.nickname);
  if (!nick.ok) return c.json({ error: nick.error }, 400);

  const s = typeof body.sessionId === "string" ? await getSession(db, body.sessionId) : null;
  if (!s) return c.json({ error: "セッションが見つかりません。" }, 404);
  if (s.finished_at == null) return c.json({ error: "クイズが終わっていません。" }, 409);
  if (s.ranked === 1) return c.json({ error: "このプレイはすでに登録済みです。" }, 409);

  const total = (JSON.parse(s.question_ids) as number[]).length;
  const accuracy = s.correct_count / total;
  const elapsed = s.finished_at - s.started_at;
  const now = Date.now();
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO rankings (session_id, course_id, nickname, correct_count, total, accuracy, elapsed_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(s.id, s.course_id, nick.value, s.correct_count, total, accuracy, elapsed, now),
      db.prepare("UPDATE quiz_sessions SET ranked = 1 WHERE id = ?").bind(s.id),
    ]);
  } catch {
    return c.json({ error: "このプレイはすでに登録済みです。" }, 409);
  }

  // 登録した記録の順位（同条件なら先に登録した人が上位）
  const better = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM rankings
        WHERE course_id = ?1 AND is_hidden = 0
          AND (accuracy > ?2 OR (accuracy = ?2 AND elapsed_ms < ?3)
               OR (accuracy = ?2 AND elapsed_ms = ?3 AND created_at < ?4))`,
    )
    .bind(s.course_id, accuracy, elapsed, now)
    .first<{ n: number }>();
  return c.json({ rank: (better?.n ?? 0) + 1 }, 201);
});

// ---- 画像（R2） ----

app.get("/img/*", async (c) => {
  const key = decodeURIComponent(c.req.path.slice("/img/".length));
  if (!/^[a-z0-9][a-z0-9/_.-]*\.(jpe?g|png|webp)$/i.test(key) || key.includes("..")) {
    return c.text("Not Found", 404);
  }
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.text("Not Found", 404);

  const etag = obj.httpEtag;
  if (c.req.header("If-None-Match") === etag) return c.body(null, 304, { ETag: etag });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", etag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// ---- 定期処理：放置された古いセッションを削除する ----

async function cleanup(env: Env) {
  const threshold = Date.now() - SESSION_TTL_MS;
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM quiz_answers WHERE session_id IN (SELECT id FROM quiz_sessions WHERE started_at < ? AND ranked = 0)",
    ).bind(threshold),
    env.DB.prepare("DELETE FROM quiz_sessions WHERE started_at < ? AND ranked = 0").bind(threshold),
  ]);
}

export default {
  fetch: app.fetch,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(cleanup(env));
  },
} satisfies ExportedHandler<Env>;
