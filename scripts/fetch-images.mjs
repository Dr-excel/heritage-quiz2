// Wikimedia Commons から各世界遺産の写真（自由ライセンスのみ）を取得し、
// images-cache/ に保存して content/images.json にクレジット情報を書き出す。
//
// 使い方: node scripts/fetch-images.mjs [--force] [--only=siteId,siteId]
// 特定の遺産の画像を差し替えたい場合は content/image-overrides.json に
// { "サイトID": "File:ファイル名.jpg" } を書いて再実行する。

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, "images-cache");
const IMAGES_JSON = path.join(ROOT, "content", "images.json");
const OVERRIDES_JSON = path.join(ROOT, "content", "image-overrides.json");
const WIDTH = 960;
const USER_AGENT = "heritage-quiz2/0.1 (https://github.com/Dr-excel/heritage-quiz2; educational quiz)";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(u, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} ${u}`);
  }
  throw new Error(`retry exhausted ${u}`);
}

function stripHtml(s) {
  return (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// 自由ライセンス（CC BY / CC BY-SA / CC0 / パブリックドメイン）だけを許可する
function acceptableLicense(meta) {
  const name = meta?.LicenseShortName?.value ?? "";
  if (meta?.NonFree?.value === "true") return null;
  if (/^(cc[ -]by([ -]sa)?|cc0|public domain|pd\b|attribution)/i.test(name)) return name;
  return null;
}

// 地図・ロゴ・図などは写真として不適切なので除外する
const NOT_PHOTO = /map|karte|carte|locator|location|logo|flag|coat of arms|diagram|satellite|landsat|\.svg/i;

function toRecord(page) {
  if (NOT_PHOTO.test(page?.title ?? "")) return null;
  const info = page?.imageinfo?.[0];
  if (!info || !["image/jpeg", "image/png"].includes(info.mime)) return null;
  const meta = info.extmetadata;
  const license = acceptableLicense(meta);
  if (!license) return null;
  if ((info.width ?? 0) < 640) return null;
  let credit = stripHtml(meta?.Artist?.value);
  if (!credit) credit = stripHtml(meta?.Credit?.value) || "Unknown author";
  if (credit.length > 120) credit = credit.slice(0, 117) + "…";
  return {
    title: page.title,
    thumbUrl: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    mime: info.mime,
    credit,
    license,
    licenseUrl: meta?.LicenseUrl?.value ?? null,
    sourceUrl: info.descriptionurl,
  };
}

const IMAGEINFO = { prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: String(WIDTH) };

async function commonsInfo(fileTitles) {
  const out = new Map();
  for (let i = 0; i < fileTitles.length; i += 40) {
    const batch = fileTitles.slice(i, i + 40);
    const data = await getJson("https://commons.wikimedia.org/w/api.php", {
      action: "query",
      titles: batch.join("|"),
      ...IMAGEINFO,
    });
    const norm = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of data.query?.pages ?? []) {
      if (p.missing) continue;
      out.set(norm.get(p.title) ?? p.title, toRecord(p));
    }
    await sleep(300);
  }
  return out;
}

// 英語版 Wikipedia 記事の代表画像（自由ライセンスのもの）のファイル名を取得する
async function pageImages(wikiTitles) {
  const out = new Map();
  for (let i = 0; i < wikiTitles.length; i += 40) {
    const batch = wikiTitles.slice(i, i + 40);
    const data = await getJson("https://en.wikipedia.org/w/api.php", {
      action: "query",
      titles: batch.join("|"),
      prop: "pageimages",
      piprop: "name",
      pilicense: "free",
      redirects: "1",
    });
    const back = new Map();
    for (const n of data.query?.normalized ?? []) back.set(n.to, n.from);
    for (const r of data.query?.redirects ?? []) back.set(r.to, back.get(r.from) ?? r.from);
    for (const p of data.query?.pages ?? []) {
      if (!p.pageimage) continue;
      out.set(back.get(p.title) ?? p.title, `File:${p.pageimage}`);
    }
    await sleep(300);
  }
  return out;
}

// 代表画像が使えない場合の予備：Commons を英語名で検索する
async function searchCommons(query) {
  const data = await getJson("https://commons.wikimedia.org/w/api.php", {
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "8",
    ...IMAGEINFO,
  });
  const pages = (data.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of pages) {
    const rec = toRecord(p);
    if (rec && rec.width >= 800) return rec;
  }
  return null;
}

async function download(url, dest) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`download failed ${url}`);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const sites = JSON.parse(await fs.readFile(path.join(ROOT, "content", "sites.json"), "utf8"));
  const overrides = await readJson(OVERRIDES_JSON, {});
  const images = await readJson(IMAGES_JSON, {});
  await fs.mkdir(path.join(CACHE_DIR, "sites"), { recursive: true });

  const targets = sites.filter((s) => (only ? only.includes(s.id) : force || !images[s.id] || overrides[s.id]));
  console.log(`対象 ${targets.length} 件`);

  // 上書き設定は "File:ファイル名" でファイルを直接指定するか、"search:キーワード" で Commons を検索する
  const fileOverride = (id) => (overrides[id]?.startsWith("File:") ? overrides[id] : null);
  const searchOverride = (id) => (overrides[id]?.startsWith("search:") ? overrides[id].slice(7) : null);

  const pageImg = await pageImages([...new Set(targets.filter((s) => !overrides[s.id]).map((s) => s.wiki))]);
  const fileTitles = [
    ...new Set(targets.map((s) => fileOverride(s.id) ?? pageImg.get(s.wiki)).filter(Boolean)),
  ];
  const infos = await commonsInfo(fileTitles);

  const failed = [];
  for (const site of targets) {
    const file = fileOverride(site.id) ?? (overrides[site.id] ? null : pageImg.get(site.wiki));
    let rec = file ? infos.get(file) : null;
    if (!rec && !fileOverride(site.id)) {
      rec = await searchCommons(searchOverride(site.id) ?? site.wiki);
      await sleep(300);
    }
    if (!rec) {
      failed.push(site.id);
      console.log(`× ${site.id} (${site.wiki})`);
      continue;
    }
    const ext = rec.mime === "image/png" ? "png" : "jpg";
    const key = `sites/${site.id}.${ext}`;
    try {
      await download(rec.thumbUrl, path.join(CACHE_DIR, key));
    } catch (e) {
      failed.push(site.id);
      console.log(`× ${site.id} ${e.message}`);
      continue;
    }
    images[site.id] = {
      key,
      width: rec.width,
      height: rec.height,
      credit: rec.credit,
      license: rec.license,
      licenseUrl: rec.licenseUrl,
      sourceUrl: rec.sourceUrl,
      file: rec.title,
    };
    console.log(`○ ${site.id} ← ${rec.title} [${rec.license}]`);
    await sleep(400);
  }

  const sorted = Object.fromEntries(Object.entries(images).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(IMAGES_JSON, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`\n完了: ${Object.keys(sorted).length}/${sites.length} 件の画像あり。失敗: ${failed.join(", ") || "なし"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
