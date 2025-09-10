# 環境変数リファレンス（MVP）

開発時は `.env.example` をコピーして `.env` を作成してください。機密値は開発用のものを用意し、プロダクションの秘密は別途Secret管理へ。

## Core
- `APP_ENV`: 環境名（local|stg|prod）
- `PORT`: サーバポート（例: 8080）
- `DATABASE_URL`: RDB接続文字列（例: Postgres/他）
- `REDIS_URL`: 任意（キューやレート制限で使用する場合）

## Auth (OIDC / Tokens)
- `OIDC_GOOGLE_CLIENT_ID`
- `OIDC_GOOGLE_CLIENT_SECRET`
- `OIDC_APPLE_CLIENT_ID`
- `OIDC_APPLE_TEAM_ID`
- `OIDC_APPLE_KEY_ID`
- `OIDC_APPLE_PRIVATE_KEY`（PEM、Base64等の取り扱いは実装に合わせる）
- `ACCESS_TOKEN_TTL`（例: 15m）
- `REFRESH_TOKEN_TTL`（例: 30d）
- `REFRESH_COOKIE_NAME`（既定: `refresh_token`）
- `COOKIE_DOMAIN`（例: `.posipost.example.com`／ローカルは空またはlocalhost）

### Auth.js（Prisma Adapterを使う場合の代表的な変数）
- `AUTH_SECRET`（必須）
- `AUTH_URL`（Next.js以外/リバースプロキシ配下などで必要）
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`（プロバイダ設定をENVから渡す場合）
- `AUTH_APPLE_ID` / `AUTH_APPLE_SECRET`（同上、SecretはJWT生成などで別途組み立てる場合あり）

## CORS / Web
- `CORS_ALLOWED_ORIGIN`（カンマ区切り可。例: `http://localhost:3000,https://stg.app.posipost.example.com,https://app.posipost.example.com`）
- `CORS_ALLOW_CREDENTIALS`（`true`）

## Scoring (Gemini)
- `GEMINI_API_KEY`
- `GEMINI_MODEL`（既定: `gemini-1.5-pro`）
- `GEMINI_TIMEOUT_MS`（既定: 1000）
- `SCORING_THRESHOLD`（既定: 0.70）

## Rate Limits（RPM）
- `RATE_LIMIT_ANON_LIST_POSTS`（既定: 60）
- `RATE_LIMIT_ANON_GET_POST`（既定: 120）
- `RATE_LIMIT_USER_CREATE_DRAFT`（既定: 30）
- `RATE_LIMIT_USER_PUBLISH`（既定: 6）
- `RATE_LIMIT_USER_REACTION`（既定: 30）
- `RATE_LIMIT_USER_SCORE_TEXT`（既定: 20）

## Retention / Ops
- `RETENTION_DRAFT_DAYS`（既定: 90）
- `RETENTION_BLOCK_LOG_DAYS`（既定: 30）
- `RETENTION_AUDIT_DAYS`（既定: 180）
- `RETENTION_ACCESS_LOG_DAYS`（既定: 30）
