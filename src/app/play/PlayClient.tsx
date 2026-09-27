"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Photo } from "@/components/Photo";
import { api, ApiRequestError } from "@/lib/api";
import { courseName } from "@/lib/courses";
import type { AnswerResult, QuestionView, SessionState } from "@/lib/types";

export function PlayClient() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("id");
  const course = params.get("course");

  const [session, setSession] = useState<SessionState | null>(null);
  const [question, setQuestion] = useState<QuestionView | null>(null);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const loadQuestion = useCallback(async (id: string, position: number) => {
    const q = await api<QuestionView>(`/api/sessions/${id}/questions/${position}`);
    setQuestion(q);
    setAnswer(q.answered);
    window.scrollTo({ top: 0 });
  }, []);

  // 開始：course 指定なら新規セッションを作り、id 指定なら続きから再開する
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        if (sessionId) {
          const s = await api<SessionState>(`/api/sessions/${sessionId}`);
          if (s.finished) {
            router.replace(`/result?id=${s.sessionId}`);
            return;
          }
          setSession(s);
          await loadQuestion(s.sessionId, s.answeredCount + 1);
        } else if (course) {
          const s = await api<SessionState>("/api/sessions", { method: "POST", body: { courseId: course } });
          // リロードしても続きから遊べるよう URL にセッション ID を残す
          router.replace(`/play?id=${s.sessionId}`);
          setSession(s);
          await loadQuestion(s.sessionId, 1);
        } else {
          setError("コースが指定されていません。");
        }
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : "読み込みに失敗しました。");
      }
    })();
  }, [sessionId, course, router, loadQuestion]);

  const choose = useCallback(
    async (choiceId: number) => {
      if (!session || !question || answer || pending) return;
      setPending(true);
      try {
        const r = await api<AnswerResult>(`/api/sessions/${session.sessionId}/answers`, {
          method: "POST",
          body: { position: question.position, choiceId },
        });
        setAnswer(r);
        setSession({ ...session, answeredCount: question.position, correctCount: r.correctCount, finished: r.finished });
        requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (e) {
        setError(e instanceof ApiRequestError ? e.message : "回答を送信できませんでした。");
      } finally {
        setPending(false);
      }
    },
    [session, question, answer, pending],
  );

  const next = useCallback(async () => {
    if (!session || !question || !answer) return;
    if (answer.finished || question.position >= question.total) {
      router.push(`/result?id=${session.sessionId}`);
      return;
    }
    setPending(true);
    try {
      await loadQuestion(session.sessionId, question.position + 1);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "次の問題を読み込めませんでした。");
    } finally {
      setPending(false);
    }
  }, [session, question, answer, router, loadQuestion]);

  // キーボード操作：1〜3 で回答、Enter で次へ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!question) return;
      if (!answer && ["1", "2", "3"].includes(e.key)) {
        const c = question.choices[Number(e.key) - 1];
        if (c) choose(c.id);
      } else if (answer && e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, answer, choose, next]);

  if (error) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <p className="font-bold text-wrong">{error}</p>
        <Link href="/" className="inline-block rounded-lg bg-primary px-4 py-2 font-bold text-on-primary">
          トップへ戻る
        </Link>
      </div>
    );
  }

  if (!session || !question) return <p className="text-muted">問題を準備しています…</p>;

  const isLast = question.position >= question.total;
  const labels = ["A", "B", "C"];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="rounded-full bg-primary-soft px-3 py-0.5 font-bold text-primary">
            {courseName(session.courseId)}
          </span>
          <span className="text-muted">
            <span className="font-bold text-text">第{question.position}問</span> / {question.total}問 ・ 正解{" "}
            {session.correctCount}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={question.total}
          aria-valuenow={question.position}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(question.position / question.total) * 100}%` }}
          />
        </div>
      </div>

      {question.image && <Photo image={question.image} priority />}

      <h1 className="text-lg sm:text-xl font-bold leading-relaxed whitespace-pre-line">{question.body}</h1>

      <ul className="grid gap-3">
        {question.choices.map((c, i) => {
          const isCorrect = answer?.correctChoiceId === c.id;
          const isChosen = answer?.choiceId === c.id;
          let tone = "border-border bg-surface hover:border-primary hover:bg-primary-soft";
          if (answer) {
            if (isCorrect) tone = "border-correct bg-correct-soft";
            else if (isChosen) tone = "border-wrong bg-wrong-soft";
            else tone = "border-border bg-surface opacity-60";
          }
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => choose(c.id)}
                disabled={!!answer || pending}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left text-base transition disabled:cursor-default ${tone}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
                  {labels[i]}
                </span>
                <span className="flex-1">{c.body}</span>
                {answer && isCorrect && <span className="font-bold text-correct">正解</span>}
                {answer && isChosen && !isCorrect && <span className="font-bold text-wrong">あなた</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {answer && (
        <div ref={feedbackRef} className="scroll-mt-20 space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <p className={`text-xl font-bold ${answer.correct ? "text-correct" : "text-wrong"}`} role="status">
            {answer.correct ? "◯ 正解！" : "✕ 不正解"}
          </p>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-muted">解説</h2>
            <p className="whitespace-pre-line">{answer.explanation}</p>
          </div>
          {answer.explanationImage && answer.explanationImage.url !== question.image?.url && (
            <Photo image={answer.explanationImage} />
          )}
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="w-full rounded-xl bg-primary px-4 py-3 text-lg font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {isLast ? "結果を見る" : "次の問題へ"}
          </button>
        </div>
      )}
    </div>
  );
}
