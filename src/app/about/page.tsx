import type { Metadata } from "next";
import { IMAGES, SITES } from "@/lib/content";

export const metadata: Metadata = { title: "このアプリについて" };

export default function AboutPage() {
  const credits = SITES.filter((s) => IMAGES[s.id]).map((s) => ({ site: s, img: IMAGES[s.id] }));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">このアプリについて</h1>
        <p>
          世界遺産の知識を楽しく身につけるための3択クイズです。初級・中級・上級の各コースに200問以上を用意し、毎回ランダムに10問を出題します。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>本アプリは学習用の非公式クイズです。世界遺産検定（主催：NPO法人世界遺産アカデミー）およびユネスコとは関係ありません。</li>
          <li>問題と解説は2025年の第47回世界遺産委員会までの情報をもとに作成しています。内容の誤りに気づいた場合はGitHubのIssueでお知らせください。</li>
          <li>ランキングに登録したニックネームは公開されます。不適切な名前は予告なく非表示にすることがあります。</li>
        </ul>
      </section>

      <section id="credits" className="space-y-3 scroll-mt-20">
        <h2 className="text-xl font-bold">写真クレジット</h2>
        <p className="text-sm text-muted">
          写真はすべて Wikimedia Commons で公開されている自由ライセンスの画像で、サイズを縮小して使用しています。各ライセンスの条件に従い、作者とライセンスを表示します。
        </p>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {credits.map(({ site, img }) => (
            <li key={site.id} className="px-4 py-2">
              <span className="font-bold">{site.ja}</span>
              <span className="text-muted">
                {" "}
                —{" "}
                <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {img.credit}
                </a>
                {" / "}
                {img.licenseUrl ? (
                  <a href={img.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
                    {img.license}
                  </a>
                ) : (
                  img.license
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
