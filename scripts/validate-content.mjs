// 問題データを検証し、コースごとの問題数と画像付きの割合を表示する
import { COURSES, loadContent } from "./lib/content.mjs";

const { questions, images, errors } = loadContent();

for (const c of COURSES) {
  const qs = questions.filter((q) => q.course === c.id);
  const withImage = qs.filter((q) => q.s && images[q.s] && q.p !== "n").length;
  console.log(`${c.name}: ${qs.length}問（画像付き ${withImage}問 / ${Math.round((withImage / qs.length) * 100)}%）`);
}

if (errors.length) {
  console.error(`\nエラー ${errors.length}件:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\nOK");
