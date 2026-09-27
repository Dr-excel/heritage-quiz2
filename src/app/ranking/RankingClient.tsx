"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";
import { COURSES, formatElapsed } from "@/lib/courses";
import type { CourseId, RankingEntry } from "@/lib/types";

export function RankingClient() {
  const param = useSearchParams().get("course");
  const course: CourseId = COURSES.some((c) => c.id === param) ? (param as CourseId) : "beginner";

  const [entries, setEntries] = useState<RankingEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    setError(null);
    api<{ entries: RankingEntry[] }>(`/api/rankings?course=${course}&limit=50`)
      .then((r) => setEntries(r.entries))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : "読み込めませんでした。"));
  }, [course]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">正答率ランキング</h1>

      <nav className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1" aria-label="コース">
        {COURSES.map((c) => (
          <Link
            key={c.id}
            href={`/ranking?course=${c.id}`}
            replace
            aria-current={c.id === course ? "page" : undefined}
            className={`rounded-lg py-2 text-center font-bold ${
              c.id === course ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {error && <p className="font-bold text-wrong">{error}</p>}
      {!entries && !error && <p className="text-muted">読み込み中…</p>}
      {entries && entries.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-muted">
          まだ登録がありません。
          <Link href={`/play?course=${course}`} className="text-primary underline">
            最初の挑戦者になろう
          </Link>
        </p>
      )}
      {entries && entries.length > 0 && (
        <ol className="overflow-hidden rounded-xl border border-border bg-surface">
          {entries.map((e) => (
            <li key={e.rank} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <span
                className={`w-8 text-center text-lg font-bold ${
                  e.rank === 1 ? "text-accent" : e.rank <= 3 ? "text-primary" : "text-muted"
                }`}
              >
                {e.rank}
              </span>
              <span className="flex-1 min-w-0 truncate font-bold">{e.nickname}</span>
              <span className="text-right">
                <span className="font-bold">{Math.round(e.accuracy * 100)}%</span>
                <span className="block text-xs text-muted">
                  {e.correctCount}/{e.total}問 ・ {formatElapsed(e.elapsedMs)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
