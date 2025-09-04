# RouteMap（operationId ↔ 実装ハンドラ対応表）

OpenAPIの `operationId` と、実装の関数/ファイルを1対1で対応付けるための表です。実装言語/フレームワークに合わせて右欄を更新してください。

> 命名規則の例: `src/handlers/<domain>/<name>.ts` のデフォルトエクスポート

## Auth
- `listAuthProviders` → src/handlers/auth/listProviders
- `refreshAccessToken` → src/handlers/auth/refresh
- `logout` → src/handlers/auth/logout

## Health
- `getHealthz` → src/handlers/healthz

## Drafts
- `createDraft` → src/handlers/drafts/create
- `getDraft` → src/handlers/drafts/get
- `updateDraft` → src/handlers/drafts/update
- `deleteDraft` → src/handlers/drafts/delete
- `publishDraft` → src/handlers/drafts/publish

## Scoring
- `scoreText` → src/handlers/scoring/scoreText

## Posts
- `createPostDirect` → src/handlers/posts/createDirect
- `listPosts` → src/handlers/posts/list
- `getPost` → src/handlers/posts/get
- `deletePost` → src/handlers/posts/delete
- `restorePost` → src/handlers/posts/restore

## Reactions
- `upsertReaction` → src/handlers/reactions/upsert
- `removeReaction` → src/handlers/reactions/remove

## Notifications
- `listNotifications` → src/handlers/notifications/list

