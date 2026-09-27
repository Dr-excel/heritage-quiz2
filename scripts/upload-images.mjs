// images-cache/ の画像を R2 バケットへアップロードする。
// 使い方: node scripts/upload-images.mjs --local | --remote
//   --local  … wrangler の getPlatformProxy でローカルの R2（.wrangler/state）へ直接書き込む
//   --remote … wrangler r2 object put を並列に実行して本番の R2 へ書き込む

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./lib/content.mjs";

const target = process.argv.includes("--remote") ? "remote" : process.argv.includes("--local") ? "local" : null;
if (!target) {
  console.error("--local か --remote を指定してください");
  process.exit(1);
}

const BUCKET = "heritage-quiz2-images";
const CONCURRENCY = 6;
const images = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, "content", "images.json"), "utf8")));

for (const img of images) {
  if (!fs.existsSync(path.join(ROOT, "images-cache", img.key))) {
    console.error(`見つかりません: images-cache/${img.key}（先に npm run images:fetch を実行してください）`);
    process.exit(1);
  }
}

const contentType = (key) => (key.endsWith(".png") ? "image/png" : "image/jpeg");

async function uploadLocal() {
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy({ configPath: path.join(ROOT, "wrangler.jsonc") });
  try {
    let done = 0;
    for (const img of images) {
      const body = fs.readFileSync(path.join(ROOT, "images-cache", img.key));
      await proxy.env.IMAGES.put(img.key, body, { httpMetadata: { contentType: contentType(img.key) } });
      if (++done % 50 === 0 || done === images.length) console.log(`${done}/${images.length}`);
    }
  } finally {
    await proxy.dispose();
  }
}

function putRemote(img) {
  // Windows ではシェル経由で起動するため、空白を含み得る絶対パスではなく相対パスを渡す
  const relFile = path.posix.join("images-cache", img.key);
  const args = ["wrangler", "r2", "object", "put", `${BUCKET}/${img.key}`, "--file", relFile, "--content-type", contentType(img.key), "--remote"];
  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"], shell: process.platform === "win32" });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${img.key}\n${stderr}`))));
  });
}

async function uploadRemote() {
  const queue = [...images];
  let done = 0;
  const worker = async () => {
    for (let img = queue.shift(); img; img = queue.shift()) {
      await putRemote(img);
      if (++done % 25 === 0 || done === images.length) console.log(`${done}/${images.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

(target === "local" ? uploadLocal() : uploadRemote())
  .then(() => console.log("アップロード完了"))
  .catch((e) => {
    console.error(`失敗: ${e.message}`);
    process.exit(1);
  });
