import type { Metadata } from "next";
import { Suspense } from "react";
import { RankingClient } from "./RankingClient";

export const metadata: Metadata = { title: "ランキング" };

export default function RankingPage() {
  return (
    <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
      <RankingClient />
    </Suspense>
  );
}
