import type { Metadata } from "next";
import { Suspense } from "react";
import { ResultClient } from "./ResultClient";

export const metadata: Metadata = { title: "結果", robots: { index: false } };

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
      <ResultClient />
    </Suspense>
  );
}
