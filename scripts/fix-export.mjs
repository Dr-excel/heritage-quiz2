// Next.js の静的出力では先読み用ファイルが `about/__next.about/__PAGE__.txt` に出力されるが、
// クライアントは `about/__next.about.__PAGE__.txt` を要求して 404 になるため、要求されるパスにも複製する

import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "..", "out");
let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === "_next") continue;
    if (entry.name.startsWith("__next.")) {
      for (const f of fs.readdirSync(full)) {
        if (!f.endsWith(".txt")) continue;
        fs.copyFileSync(path.join(full, f), path.join(dir, `${entry.name}.${f}`));
        copied++;
      }
    }
    walk(full);
  }
}

walk(OUT);
console.log(`先読み用ファイルを ${copied} 件複製しました`);
