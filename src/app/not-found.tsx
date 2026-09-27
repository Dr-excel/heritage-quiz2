import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <Link href="/" className="inline-block rounded-lg bg-primary px-4 py-2 font-bold text-on-primary">
        トップへ戻る
      </Link>
    </div>
  );
}
