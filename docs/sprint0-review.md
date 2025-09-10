# Sprint 0 復習ドキュメント（初心者向け）

このドキュメントは、Sprint 0 で行った作業を「あとから自分で再現・復習」できるようにまとめたものです。何を・なぜ・どうやって・どう確認するかを、できるだけ丁寧に説明します。

---

## この章でわかること
- モノレポ（web と api を同じリポジトリで管理）を作る理由とやり方
- web（Next.js）と api（Fastify）の“最小で動く”箱の作り方
- OpenAPI → 型生成（TypeScript）で実装と仕様を揃える手順
- Lint / Typecheck / Test / Healthz を揃えて「壊れていない」状態を保つ方法
- よくあるエラーとその直し方（再発防止メモ）

---

## まず全体像（地図）
- つくった箱: モノレポ（`web`=フロント、`api`=バックエンド、`packages/api-types`=共通型）
- 表の家（web）: Next.js + TypeScript + Tailwind（アプリの見た目）
- 裏の家（api）: Fastify + TypeScript（APIサーバ。CORS/Cookie/ログの土台込み）
- 合言葉（仕様）: OpenAPI → 型自動生成（実装と仕様のズレを機械で減らす）
- 安心の見張り: Lint（書き方）/ Typecheck（型）/ Test（空でもOK）/ Healthz（生存確認）
- 呼び鈴（起動）: ルートの `pnpm dev` で web と api を同時起動

---

## ゴール（Definition of Done）
- `pnpm dev` で web と api が同時起動する
- `GET /healthz` が 200 を返す（API生存確認）
- `docs/Openapi.yaml` からの型生成が成功（`packages/api-types/index.d.ts` が出力）
- `pnpm run lint && pnpm run typecheck && pnpm run test` が Green（エラーなし）
- `docs/API/RouteMap.md` の Health 行が実装先（`api/src/server.ts`）を指す

---

## 用語ミニ辞典（3分で把握）
- モノレポ: 1つのリポジトリで複数プロジェクト（web/api等）を管理。型や設定を共有しやすい。
- pnpm ワークスペース: モノレポの“家族宣言”。どのフォルダが同居かを定義。
- Lint / Typecheck: 人の見落としを機械で検出（書き方/型のミスを早期に止める）。
- Healthz: サーバの“生存”を最小コストで確認するエンドポイント（/healthz）。
- OpenAPI: APIの設計書。ここから TypeScript 型を自動生成して実装を誘導。
- CORS: 別ドメインからAPIを呼べるかのルール（許可オリジンを設定）。
- Cookie: ブラウザが保存する小さな情報。認証では HttpOnly/SameSite などで安全に扱う。

---

## Step 0: 環境を用意する（なぜ必要？）
- 目的: 後工程で詰まらないよう、“鍵束（.env）”と最小設定を先に用意。
- やること:
  - `.env.example` を `.env` にコピーし、最低限のキーを入れる。
    - `APP_ENV=local`
    - `PORT=8080`（APIのポート）
    - `CORS_ALLOWED_ORIGIN=http://localhost:3000`（webからの呼び出しを許可）
    - `CORS_ALLOW_CREDENTIALS=true`
    - `COOKIE_DOMAIN=localhost`
  - `.gitignore` に `.env` が入っていることを確認（秘密をGitに上げない）。
- 確認: `.env` が存在し、上記キーが設定済み。

---

## Step 1: モノレポの骨組みを作る
- 目的: web と api を同じルールで管理し、共通の型やツールを共有。
- やること（ルート直下）:
  - `pnpm-workspace.yaml`: `web`, `api`, `packages/*` を家族宣言。
  - `package.json`（ルート）に横断スクリプトを用意。
    - `dev`（web と api を同時起動）
    - `build / lint / typecheck / test`（品質チェック）
    - `gen:api-types`（OpenAPI → 型生成）
  - `tsconfig.base.json`: TypeScript 共通設定（`strict: true` / `paths` で `@repo/api-types` を解決）。
- 確認:
  - `pnpm -v` が動く。ルート `package.json` のスクリプトが見える。

---

## Step 2: web の箱を作る（Next.js + Tailwind）
- 目的: UIを最小で起動。Sprint 8 での画面実装の土台。
- 選択: TypeScript=Yes / ESLint=Yes / Tailwind=Yes / App Router=Yes。
- ポイント: Tailwind は最初から入れるほうが移行コストがゼロ。MVPに最適。
- 確認コマンド:
  - `pnpm -C web dev` → http://localhost:3000 が開く
  - `pnpm -C web build` → エラーなし

---

## Step 3: api の箱を作る（Fastify + /healthz）
- 目的: 本番でも通用するAPIサーバの最小構成。
- 採用理由（要点）:
  - Fastify: 高速・プラグイン豊富・型と相性◎（OpenAPIとも親和性）
  - Pino: JSONログで運用に強い。
  - Zod: 入出力のバリデーション（後でOpenAPI型に寄せやすい）。
  - `@fastify/cors` / `@fastify/cookie`: 認証（Refresh Cookie）やCORS境界を後から足しやすくする。
- 実装（`api/src/server.ts` の要点）:
  - `GET /healthz` → `{ status: 'ok' }` を返す。
  - CORS: `.env` の `CORS_ALLOWED_ORIGIN` をカンマ区切りで許可。
  - Cookie: 将来の Refresh Cookie 用に登録（現時点は未使用）。
- よくあるエラーと対処:
  - ESLint が `process is not defined` → フラット設定で Node グローバル（`process`）を有効化。
  - CORS のコールバック型エラー → `cb(err, allow)` の2引数を必ず渡す（拒否時は `false`）。
- 起動確認:
  - `pnpm -C api run dev`
  - 別ターミナルで `curl -i http://localhost:8080/healthz` → 200 / `{ "status": "ok" }`

---

## Step 4: 仕様から型を自動生成（OpenAPI → TypeScript）
- 目的: 「仕様が真実、実装は従う」を機械化してズレを減らす。
- コマンド: `pnpm run gen:api-types`
- 生成物: `packages/api-types/index.d.ts`
- YAMLの注意点（ハマりやすい）:
  - `description:` に「コロン+空白（例: 0.70）」があると構文エラー。
  - 対処: ダブルクォートで囲む or `description: >-`（ブロック）を使う。

---

## Step 5: 品質チェックをそろえる（Green の状態）
- 目的: 「今は動く」を「明日も壊れない」にする。
- コマンド（ルート）:
  - `pnpm run lint`（書き方チェック）
  - `pnpm run typecheck`（型チェック）
  - `pnpm run test`（空でもOK）
- ESLint v9 の要点:
  - `.eslintrc.*` は読まない → `eslint.config.mjs`（フラット設定）を各プロジェクトに置く。
  - web は Next が自動生成、api は自分で用意する。

---

## Step 6: 同時起動と RouteMap 更新
- 目的: web ↔ api の連携準備を整える。
- 同時起動: ルートで `pnpm dev`
  - Web: http://localhost:3000
  - API: `curl -i http://localhost:8080/healthz` → 200
- ドキュメント反映: `docs/API/RouteMap.md`
  - Health: `getHealthz → api/src/server.ts`

---

## トラブルと再発防止メモ（実際に遭遇したもの）
- ESLint が設定を見つけない
  - 症状: “ESLint couldn't find eslint.config.*”
  - 原因: v9 からフラット設定必須
  - 対処: `api/eslint.config.mjs` を用意し、`pnpm exec eslint .` で実行
- `process is not defined`
  - 症状: no-undef
  - 原因: Node グローバル未設定
  - 対処: フラット設定で `globals` を追加（または `globals` パッケージ利用）
- CORS のコールバックで型エラー
  - 症状: “2個の引数が必要ですが、1個指定されました。”
  - 対処: `cb(new Error('...'), false)` のように常に2引数で呼ぶ
- OpenAPI YAML の `description` にコロンを含む
  - 対処: ダブルクォートで囲む or `>-` を使う。インデントは半角スペース2つ。

---

## 片付け（クリーンアップの提案）
- 依存を軽くする
  - `api`: `@types/pino` は不要（pinoは型同梱）→ 削除でOK。
- 設定の重複を減らす
  - ルートの `.eslintrc.json` は ESLint v9 では未使用 → 削除候補。
- CORS 環境変数の表記ゆれ
  - 現状の実装では `.env` / コードともに `CORS_ALLOWED_ORIGIN`（単数名）を利用（値はカンマ区切りで複数指定可）。
  - 将来の運用で変える場合は、コードとドキュメントを同時に更新して統一する。
- 許可ポリシーを明文化
  - 許可オリジン配列が“空”のときの扱い（全許可にする/しない）をチームで固定。

---

## コマンド早見表（コピペ用）
- 同時起動: `pnpm dev`
- Web 単体: `pnpm -C web dev`
- API 単体: `pnpm -C api run dev`
- 型生成: `pnpm run gen:api-types`
- 品質: `pnpm run lint && pnpm run typecheck && pnpm run test`
- Healthz: `curl -i http://localhost:8080/healthz`

---

## 学びポイント（今回つかんだコツ）
- 「動く骨」を先に作ると、後から捨てずに拡張できる。
- 仕様 → 型 → 実装の順番は、ズレの早期発見に効く。
- ESLint v9 は“フラット設定”。旧 `.eslintrc` のままでは動かない。
- CORS は“許可の定義”と“コールバックの2引数”を守ると安全。
- Healthz は小さいが運用で非常に重要（監視・外形監視の基点）。

---

## 次の一歩（Sprint 1 の準備）
1) Prisma 初期化（api 配下で運用）
   - スキーマ配置: `api/prisma/schema.prisma`（`docs/Data/Schema.md` の例に準拠）
2) マイグレーション実行（api でコマンド実行）
   - 開発: `pnpm --filter api exec prisma migrate dev --schema ./prisma/schema.prisma --name init`
   - 本番/Neon: `pnpm --filter api exec prisma migrate deploy --schema ./prisma/schema.prisma`
3) `/healthz` にDB疎通チェックを少し追加（例: `SELECT 1`）
4) `.env` の `DATABASE_URL` を実値に設定（Neonは `?sslmode=require` 必須）。api から Prisma を実行する場合は api カレントで `.env` が解決できるようにする（シンボリックリンクまたはコピー）。

---

## 付録：チェックリスト（DoD 確認）
- [ ] `pnpm dev` で web と api が同時起動
- [ ] `GET /healthz` が 200
- [ ] `pnpm run gen:api-types` 成功（`packages/api-types/index.d.ts` 更新）
- [ ] `pnpm run lint && pnpm run typecheck && pnpm run test` が Green
- [ ] `docs/API/RouteMap.md` に Health の実装先を反映

> このドキュメントは、復習して「自分の知識」にすることを目的に作成しています。分からない用語が出たら、まず“用語ミニ辞典”と“トラブルと再発防止メモ”を参照してください。
