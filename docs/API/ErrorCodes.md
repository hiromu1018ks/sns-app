# エラーコードとHTTPステータス（MVP）

共通レスポンス: `ErrorResponse { error: string, message?: string, details?: object }`

## ベースライン
- 400 BAD_REQUEST: `VALIDATION_ERROR` / `POST_BLOCKED`
- 401 UNAUTHORIZED: `UNAUTHORIZED`（未ログイン/トークン無効）
- 403 FORBIDDEN: `FORBIDDEN`（権限なし）
- 404 NOT_FOUND: `NOT_FOUND`
- 409 CONFLICT: `CONFLICT`（リソース競合がある場合）
- 429 TOO_MANY_REQUESTS: `RATE_LIMITED`（RateLimitヘッダを付与）
- 503 SERVICE_UNAVAILABLE: `EXTERNAL_UNAVAILABLE`（スコアリング等外部障害）
- 500 INTERNAL_SERVER_ERROR: `INTERNAL_ERROR`

## ドメイン別
### Drafts
- create/update: 400=`VALIDATION_ERROR`
- get/delete: 404=`NOT_FOUND`
- publish: 400=`POST_BLOCKED`｜503=`EXTERNAL_UNAVAILABLE`

### Posts
- createDirect: 400=`POST_BLOCKED`｜503=`EXTERNAL_UNAVAILABLE`
- get: 404=`NOT_FOUND`
- delete: 404=`NOT_FOUND`
- restore: 404=`NOT_FOUND`

### Reactions
- upsert: 404=`NOT_FOUND`（投稿なし）｜409は未使用（置換で対応）
- delete: 404=`NOT_FOUND`（自分の反応がない）

### Auth
- refresh: 401=`UNAUTHORIZED`（無効/期限切れ）
- logout: 204のみ

## RateLimitヘッダ
- `X-RateLimit-Limit`: 上限
- `X-RateLimit-Remaining`: 残数
- `X-RateLimit-Reset`: リセットUNIX秒

