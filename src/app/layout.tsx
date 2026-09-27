import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "世界遺産クイズ", template: "%s | 世界遺産クイズ" },
  description: "世界遺産検定の学習に使える3択クイズ。初級・中級・上級から選んで10問に挑戦し、正答率ランキングに登録できます。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#14171a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh flex flex-col">
        <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-10">
          <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="whitespace-nowrap font-bold text-base sm:text-lg tracking-wide text-primary">
              世界遺産クイズ
            </Link>
            <nav className="flex gap-4 whitespace-nowrap text-sm">
              <Link href="/ranking" className="hover:text-primary">
                ランキング
              </Link>
              <Link href="/about" className="hover:text-primary">
                <span className="sm:hidden">概要</span>
                <span className="hidden sm:inline">このアプリについて</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">{children}</main>
        <footer className="border-t border-border text-xs text-muted">
          <div className="mx-auto max-w-3xl px-4 py-5 space-y-1">
            <p>本アプリは学習用の非公式クイズです。世界遺産検定（主催：NPO法人世界遺産アカデミー）とは関係ありません。</p>
            <p>
              写真は Wikimedia Commons の自由ライセンス画像を使用しています。
              <Link href="/about#credits" className="underline">
                クレジット一覧
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
