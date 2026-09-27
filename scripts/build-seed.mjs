// content/ の JSON から D1 投入用の seed/seed.sql を生成する。
// 何度実行しても同じ結果になるよう UPSERT で書き込み、
// JSON から消えた問題は削除せず draft（非公開）にする（過去の回答履歴を壊さないため）

import fs from "node:fs";
import path from "node:path";
import { COURSES, ROOT, loadContent } from "./lib/content.mjs";

const { sites, images, questions, errors } = loadContent();
if (errors.length) {
  console.error("問題データにエラーがあります。先に npm run lint:content で確認してください。");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const CATEGORY = { C: "cultural", N: "natural", M: "mixed" };
const imageRef = (siteId) => (images[siteId] ? `(SELECT id FROM images WHERE r2_key = ${q(images[siteId].key)})` : "NULL");

const out = [];
out.push("-- このファイルは scripts/build-seed.mjs で生成されます。直接編集しないでください。");

for (const [i, c] of COURSES.entries()) {
  out.push(
    `INSERT INTO courses (id, name, description, sort_order) VALUES (${q(c.id)}, ${q(c.name)}, ${q(c.description)}, ${i + 1})
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;`,
  );
}

for (const s of sites) {
  out.push(
    `INSERT INTO heritage_sites (id, name_ja, name_en, country, category, inscribed_year) VALUES (${[s.id, s.ja, s.en, s.country, CATEGORY[s.cat], s.year].map(q).join(", ")})
  ON CONFLICT(id) DO UPDATE SET name_ja = excluded.name_ja, name_en = excluded.name_en, country = excluded.country, category = excluded.category, inscribed_year = excluded.inscribed_year;`,
  );
}

for (const [siteId, img] of Object.entries(images)) {
  // 写真から遺産名を当てる問題があるため、代替テキストに遺産名は入れない
  out.push(
    `INSERT INTO images (r2_key, width, height, alt_text, credit, license, license_url, source_url, site_id) VALUES (${[
      img.key,
      img.width,
      img.height,
      "世界遺産の写真",
      img.credit,
      img.license,
      img.licenseUrl,
      img.sourceUrl,
      siteId,
    ]
      .map(q)
      .join(", ")})
  ON CONFLICT(r2_key) DO UPDATE SET width = excluded.width, height = excluded.height, alt_text = excluded.alt_text, credit = excluded.credit, license = excluded.license, license_url = excluded.license_url, source_url = excluded.source_url, site_id = excluded.site_id;`,
  );
}

out.push("UPDATE questions SET status = 'draft';");

for (const item of questions) {
  // p: 'q' = 出題時と解説時に写真を表示（既定）、'e' = 解説時のみ（写真が答えのヒントになる場合）、'n' = 表示しない
  const mode = item.s ? (item.p ?? "q") : "n";
  const qImg = mode === "q" ? imageRef(item.s) : "NULL";
  const eImg = mode === "n" ? "NULL" : imageRef(item.s);
  out.push(
    `INSERT INTO questions (id, course_id, site_id, body, image_id, explanation, explanation_image_id, status, updated_at) VALUES (${q(item.id)}, ${q(item.course)}, ${q(item.s ?? null)}, ${q(item.q)}, ${qImg}, ${q(item.e)}, ${eImg}, 'published', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ON CONFLICT(id) DO UPDATE SET course_id = excluded.course_id, site_id = excluded.site_id, body = excluded.body, image_id = excluded.image_id, explanation = excluded.explanation, explanation_image_id = excluded.explanation_image_id, status = 'published', updated_at = excluded.updated_at;`,
  );
  // 選択肢 ID = 問題 ID×10 + 番号（1 が正解）
  [item.a, ...item.w].forEach((body, k) => {
    out.push(
      `INSERT INTO choices (id, question_id, body, is_correct, sort_order) VALUES (${item.id * 10 + k + 1}, ${item.id}, ${q(body)}, ${k === 0 ? 1 : 0}, ${k + 1})
  ON CONFLICT(id) DO UPDATE SET body = excluded.body, is_correct = excluded.is_correct, sort_order = excluded.sort_order;`,
    );
  });
}

const dest = path.join(ROOT, "seed", "seed.sql");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out.join("\n") + "\n");
console.log(`seed/seed.sql を生成しました（遺産 ${sites.length}件、画像 ${Object.keys(images).length}件、問題 ${questions.length}問）`);
