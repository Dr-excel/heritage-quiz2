// 問題データの読み込みと検証（validate-content と build-seed で共有）

import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const COURSES = [
  { id: "beginner", name: "初級", description: "日本の世界遺産と世界の有名な遺産、世界遺産の基本", base: 100000 },
  { id: "intermediate", name: "中級", description: "世界各地の遺産の歴史・特徴と制度の基礎", base: 200000 },
  { id: "advanced", name: "上級", description: "条約・作業指針の細部とマイナーな遺産", base: 300000 },
];
export const MIN_PER_COURSE = 200;

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// 問題ファイルは content/questions/<コースID>-<番号>.json。
// 問題 ID = コース基数 + ファイル番号×1000 + ファイル内の順番（既存の問題の途中に挿入しないこと）
export function loadContent() {
  const sites = readJson(path.join(ROOT, "content", "sites.json"));
  const images = readJson(path.join(ROOT, "content", "images.json"));
  const siteIds = new Set(sites.map((s) => s.id));
  const dir = path.join(ROOT, "content", "questions");
  const errors = [];
  const questions = [];

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const m = /^(beginner|intermediate|advanced)-(\d+)\.json$/.exec(file);
    if (!m) {
      errors.push(`${file}: ファイル名は <コース>-<番号>.json にしてください`);
      continue;
    }
    const course = COURSES.find((c) => c.id === m[1]);
    const fileNo = Number(m[2]);
    const items = readJson(path.join(dir, file));
    if (items.length >= 1000) errors.push(`${file}: 1ファイル999問まで`);

    items.forEach((it, i) => {
      const where = `${file}#${i + 1}`;
      const id = course.base + fileNo * 1000 + i + 1;
      if (typeof it.q !== "string" || it.q.trim() === "") errors.push(`${where}: 問題文(q)がありません`);
      if (typeof it.a !== "string" || it.a.trim() === "") errors.push(`${where}: 正解(a)がありません`);
      if (!Array.isArray(it.w) || it.w.length !== 2 || it.w.some((w) => typeof w !== "string" || !w.trim())) {
        errors.push(`${where}: 誤答(w)は2つ必要です`);
      }
      if (typeof it.e !== "string" || it.e.trim() === "") errors.push(`${where}: 解説(e)がありません`);
      const choices = [it.a, ...(it.w ?? [])];
      if (new Set(choices).size !== choices.length) errors.push(`${where}: 選択肢が重複しています`);
      if (it.s != null && !siteIds.has(it.s)) errors.push(`${where}: 遺産ID ${it.s} が sites.json にありません`);
      if (it.p != null && !["q", "e", "n"].includes(it.p)) errors.push(`${where}: p は q/e/n のいずれかです`);
      if (/^写真/.test(it.q ?? "") && (it.s == null || !images[it.s])) errors.push(`${where}: 写真を参照していますが画像がありません`);
      questions.push({ ...it, id, course: course.id, where });
    });
  }

  // 同じコース内の問題文の重複を検出する
  const seen = new Map();
  for (const q of questions) {
    const key = `${q.course}:${q.q}`;
    if (seen.has(key)) errors.push(`${q.where}: ${seen.get(key)} と問題文が重複しています`);
    else seen.set(key, q.where);
  }
  for (const c of COURSES) {
    const n = questions.filter((q) => q.course === c.id).length;
    if (n < MIN_PER_COURSE) errors.push(`${c.name}: ${n}問しかありません（${MIN_PER_COURSE}問以上必要）`);
  }
  return { sites, images, questions, errors };
}
