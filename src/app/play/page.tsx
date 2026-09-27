import type { Metadata } from "next";
import { Suspense } from "react";
import { PlayClient } from "./PlayClient";

export const metadata: Metadata = { title: "クイズ", robots: { index: false } };

export default function PlayPage() {
  return (
    <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
      <PlayClient />
    </Suspense>
  );
}
