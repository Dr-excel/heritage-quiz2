"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Turnstile } from "@/components/Turnstile";
import { api, ApiRequestError } from "@/lib/api";
import { courseName, formatElapsed } from "@/lib/courses";
import type { ResultView } from "@/lib/types";

function comment(rate: number): string {
  if (rate === 1) return "全問正解！ 見事です。";
  if (rate >= 0.8) return "すばらしい！ 合格ラインを超えています。";
  if (rate >= 0.6) return "あと一歩。解説を復習してもう一度挑戦しましょう。";
  return "解説を読んで知識を広げていきましょう。";
}

export function ResultClient() {
  const id = useSearchParams().get("id");
  const [result, setResult] = useState<ResultView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  // 登録失敗時に Turnstile を作り直すためのキー
  const [widgetKey, setWidgetKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setError("結果が見つかりません。");
      return;
    }
    api<ResultView>(`/api/sessions/${id}/result`)
      .then(setResult)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "結果を読み込めませんでした。"));
  }, [id]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!result || !token || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const r = await api<{ rank: number }>("/api/rankings", {
        method: "POST",
        body: { sessionId: result.sessionId, nickname, turnstileToken: token },
      });
      setRank(r.rank);
      setResult({ ...result, ranked: true });
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "登録できませんでした。");
      setToken(null);
      setWidgetKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

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
  if (!result) return <p className="text-muted">採点しています…</p>;

  if (!result.finished) {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <p>まだ回答していない問題があります。</p>
        <Link href={`/play?id=${result.sessionId}`} className="inline-block rounded-lg bg-primary px-4 py-2 font-bold text-on-primary">
          続きから解く
        </Link>
      </div>
    );
  }

  const percent = Math.round(result.accuracy * 100);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6 text-center space-y-2">
        <p className="text-sm text-muted">{courseName(result.courseId)}コース 結果</p>
        <p className="text-5xl font-bold text-primary">
          {result.correctCount}
          <span className="text-2xl text-muted"> / {result.total}問</span>
        </p>
        <p className="text-lg">
          正答率 <span className="font-bold">{percent}%</span>
          <span className="text-muted text-sm"> ・ タイム {formatElapsed(result.elapsedMs)}</span>
        </p>
        <p className="text-muted">{comment(result.accuracy)}</p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 space-y-3" aria-labelledby="rank-form">
        <h2 id="rank-form" className="font-bold">
          ランキングに登録
        </h2>
        {result.ranked ? (
          <div className="space-y-2">
            <p>
              {rank != null ? (
                <>
                  <span className="text-2xl font-bold text-accent">{rank}位</span> で登録しました！
                </>
              ) : (
                "このプレイは登録済みです。"
              )}
            </p>
            <Link href={`/ranking?course=${result.courseId}`} className="text-primary underline">
              {courseName(result.courseId)}コースのランキングを見る
            </Link>
          </div>
        ) : (
          <form onSubmit={register} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm text-muted">ニックネーム（20文字以内）</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                required
                autoComplete="nickname"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base"
                placeholder="例：遺産ハンター"
              />
            </label>
            <Turnstile key={widgetKey} onToken={setToken} />
            {formError && <p className="text-sm font-bold text-wrong">{formError}</p>}
            <button
              type="submit"
              disabled={!token || !nickname.trim() || submitting}
              className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "登録中…" : "登録する"}
            </button>
            <p className="text-xs text-muted">順位は正答率 → タイムの順で決まります。登録した名前は公開されます。</p>
          </form>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="review">
        <h2 id="review" className="font-bold">
          ふりかえり
        </h2>
        <ol className="space-y-2">
          {result.answers.map((a) => (
            <li key={a.position} className="rounded-xl border border-border bg-surface p-3 text-sm space-y-1">
              <p className="flex gap-2">
                <span className={`font-bold ${a.correct ? "text-correct" : "text-wrong"}`}>{a.correct ? "◯" : "✕"}</span>
                <span>
                  <span className="text-muted">Q{a.position}.</span> {a.body}
                </span>
              </p>
              <p className="pl-6 text-muted">
                正解：<span className="font-bold text-text">{a.correctAnswer}</span>
                {!a.correct && <> ／ あなたの回答：{a.yourAnswer}</>}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/play?course=${result.courseId}`}
          className="rounded-xl bg-primary px-4 py-3 text-center font-bold text-on-primary hover:bg-primary-hover"
        >
          同じコースにもう一度挑戦
        </Link>
        <Link href="/" className="rounded-xl border-2 border-primary px-4 py-3 text-center font-bold text-primary">
          コース選択へ
        </Link>
      </div>
    </div>
  );
}
