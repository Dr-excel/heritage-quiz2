import Link from "next/link";
import { COURSES } from "@/lib/courses";
import { siteImage } from "@/lib/content";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">写真で学ぶ 世界遺産クイズ</h1>
        <p className="text-muted">
          コースを選んで3択問題に10問チャレンジ。1問ごとに正解と解説が表示され、最後に採点して正答率ランキングに登録できます。
        </p>
      </section>

      <section aria-labelledby="courses" className="space-y-3">
        <h2 id="courses" className="text-lg font-bold">
          コースを選ぶ
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {COURSES.map((c) => {
            const img = siteImage(c.coverSiteId);
            return (
              <li key={c.id}>
                <Link
                  href={`/play?course=${c.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[16/10] bg-surface-2 overflow-hidden">
                    {img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt=""
                        width={img.width}
                        height={img.height}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-bold text-primary">{c.name}</span>
                      <span className="text-xs text-muted">{c.level}</span>
                    </div>
                    <p className="text-sm text-muted flex-1">{c.description}</p>
                    <span className="mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary group-hover:bg-primary-hover">
                      10問に挑戦する
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 text-sm space-y-1">
        <h2 className="font-bold">遊び方</h2>
        <ol className="list-decimal pl-5 text-muted space-y-0.5">
          <li>コースを選ぶと、各コース200問以上の中から10問がランダムに出題されます。</li>
          <li>3つの選択肢から答えを選ぶと、すぐに正解と解説が表示されます。</li>
          <li>10問終わると採点され、ニックネームで正答率ランキングに登録できます。</li>
        </ol>
        <p className="pt-1">
          <Link href="/ranking" className="text-primary underline">
            ランキングを見る
          </Link>
        </p>
      </section>
    </div>
  );
}
