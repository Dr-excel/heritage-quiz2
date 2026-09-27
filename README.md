# 世界遺産クイズ（heritage-quiz2）

世界遺産検定の学習用 3 択クイズ Web アプリです。初級・中級・上級からコースを選び、各コース 200 問以上の中からランダムに出題される 10 問に答えると採点され、正答率ランキングにニックネームで登録できます。1 問ごとに正解と解説を表示し、ほとんどの問題で世界遺産の写真を使います。

> 本アプリは学習用の非公式クイズです。世界遺産検定（主催：NPO 法人世界遺産アカデミー）とは関係ありません。

## 構成

| 項目 | 内容 |
|---|---|
| フロントエンド | Next.js（App Router、静的出力）+ TypeScript + Tailwind CSS |
| API | Hono（Cloudflare Workers） |
| 配信 | Workers Static Assets（静的ページ）＋ 同じ Worker の `/api/*`・`/img/*` |
| データベース | Cloudflare D1 |
| 画像 | Cloudflare R2（Worker 経由で配信） |
| 不正対策 | サーバー側での採点、Workers Rate Limiting、ニックネームの NG ワード判定 |
| 定期処理 | Cron Trigger（放置されたプレイセッションを毎日削除） |

Workers の無料プランで動くよう、画面は静的に出力し、Worker のコードは API と画像配信だけを担当します。静的ファイルの配信は無料プランでもリクエスト数の制限がありません。

```
ブラウザ ──► Cloudflare Worker (heritage-quiz2)
              ├─ /, /play, /result, /ranking, /about … 静的ファイル（out/）
              ├─ /api/*  … 出題・採点・ランキング（Hono）── D1
              └─ /img/*  … 写真 ────────────────────────── R2
```

採点はすべてサーバー側で行います。正解は回答するまでブラウザに送らず、ランキングには完了したプレイだけを 1 回まで登録できます。

## ディレクトリ

```
src/app/            画面（トップ、クイズ、結果、ランキング、このアプリについて）
src/lib/types.ts    API の型（Worker と共有）
worker/             API Worker（index.ts, nickname.ts）
migrations/         D1 のスキーマ
content/sites.json  世界遺産マスタ
content/images.json 写真のクレジット情報（scripts/fetch-images.mjs が生成）
content/questions/  問題データ（<コース>-<番号>.json）
scripts/            写真取得・問題検証・seed 生成・R2 アップロード
```

## 問題データの形式

`content/questions/<beginner|intermediate|advanced>-<番号>.json` に次の形式で書きます。

```json
{"s":"jp-himeji","q":"問題文","a":"正解","w":["誤答1","誤答2"],"e":"解説","p":"q"}
```

- `s` … 関連する遺産の ID（`content/sites.json`）。写真はこの遺産のものが使われます。なければ `null`
- `p` … 写真の表示。`q`＝出題時と解説時（既定）、`e`＝解説時のみ（写真が答えのヒントになる場合）、`n`＝表示しない
- 選択肢の順番は毎回シャッフルされます
- 問題 ID はファイル内の順番から決まるため、**既存の問題の途中に挿入せず、末尾に追加してください**。ファイルから消した問題は削除されず非公開になります

変更後は `npm run lint:content` で検証します。

## ローカル開発

```bash
npm install
npm run db:migrate:local
npm run images:fetch                # Wikimedia Commons から写真を取得（初回のみ、約80MB）
npm run images:upload:local
npm run db:seed:local
npm run preview                     # http://localhost:8787
```

画面を編集しながら確認する場合は、`npm run dev:api`（API、:8787）と `npm run dev`（Next.js、:3000）を同時に起動します。Next.js の開発サーバーが `/api` と `/img` を :8787 へ中継します。

## Cloudflare へのデプロイ

1. Cloudflare にログインする（Windows の PowerShell で `npx` がブロックされる場合は `npx.cmd` を使う）

   ```bash
   npx wrangler login
   ```

2. D1 と R2 を作成し、表示された `database_id` を `wrangler.jsonc` に書き込む

   ```bash
   npx wrangler d1 create heritage-quiz2-db
   npx wrangler r2 bucket create heritage-quiz2-images
   ```

3. スキーマ・問題・写真を反映してデプロイする（R2 は事前にダッシュボードで有効化しておく）

   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote
   npm run images:upload:remote
   npm run deploy
   ```

### GitHub Actions からのデプロイ

`.github/workflows/deploy.yml` は main へのプッシュで D1 の更新と Worker のデプロイを行います。リポジトリに次を設定してください（写真のアップロードは手動で行います）。

- Secrets: `CLOUDFLARE_API_TOKEN`（Workers・D1 の編集権限）、`CLOUDFLARE_ACCOUNT_ID`
- Variables: `DEPLOY_ENABLED` = `true`

## 無料プランでの目安

- Workers：API と画像で 1 日 10 万リクエストまで（1 プレイあたり約 30 リクエスト → 1 日約 3000 プレイ）
- D1：1 日 500 万行の読み取り、10 万行の書き込みまで
- R2：保存 10GB まで（写真は約 80MB）

## ランキングの管理

不適切なニックネームは NG ワードで自動的に弾きます。すり抜けたものは次のコマンドで非表示にできます。

```bash
npx wrangler d1 execute DB --remote --command "UPDATE rankings SET is_hidden = 1 WHERE nickname = '対象の名前'"
```

## 写真のクレジット

写真は Wikimedia Commons の自由ライセンス（CC BY / CC BY-SA / CC0 / パブリックドメイン）の画像を縮小して使用し、アプリ内の各写真と「このアプリについて」ページに作者とライセンスを表示しています。画像ファイル本体はリポジトリに含めず、`npm run images:fetch` で再取得できます。
