# PosiPost 開発ガイド（MVP）

このリポジトリでMVP実装を進めるための最小限ガイドです。詳細仕様は `docs/Requirements.md` と `docs/Openapi.yaml` を参照してください。

## 前提
- 必要ツール: Git、任意のランタイム/フレームワーク、パッケージマネージャ（言語に応じて）。
- 外部依存: OIDC（Google/Apple）、スコアリング（Gemini）。
- ストレージ: 任意のRDB（例: PostgreSQL）。接続文字列は `DATABASE_URL` を利用します。

## セットアップ（最小）
1. `.env.example` をコピーして `.env` を作成し、値を埋める。
2. DBを用意し、`docs/Data/Schema.md` に沿って初期スキーマを作成。
3. CORSの許可オリジンとCookieドメインがローカル環境に合っているか確認。
4. サーバを起動し、`/healthz` で稼働確認。

## 開発の指針
- API仕様は OpenAPI 3.1（`docs/Openapi.yaml`）。新規エンドポイントは先にOpenAPIへ追加→実装。
- ハンドラと `operationId` の対応は `docs/API/RouteMap.md` を参照し、迷子を防ぐ。
- エラーは `docs/API/ErrorCodes.md` のコードを返す。429/503等の運用系も含む。
- 認証はOAuth2/OIDC（Google/Apple）、Accessトークンは15分、Refreshは30日（HttpOnly Cookie）。詳細は `docs/Security/AuthConfig.md`。
- データスキーマ/マイグレーション方針は `docs/Data/Schema.md`。

## よくある動作確認
- 匿名閲覧: `GET /v1/posts` / `GET /v1/posts/{id}` が 200 で返る（未認証）。
- ログイン: OIDC経由でログイン→Accessトークン取得→認証APIにアクセス可能。
- 下書き→公開: `POST /v1/drafts` → `PATCH /v1/drafts/{id}` → `POST /v1/drafts/{id}:publish`。
- 直接投稿: `POST /v1/posts`（スコア未達は400で提案）。
- リアクション: `POST /v1/posts/{id}/reactions`（置換/冪等の挙動）→ `DELETE` で取り消し。
- リフレッシュ: `POST /v1/auth/refresh`（HttpOnly Cookieが必要）。

## クライアント生成（任意）
OpenAPIクライアント生成を使う場合は、採用言語に合わせて `docs/Openapi.yaml` から生成してください（例: openapi-generator）。

