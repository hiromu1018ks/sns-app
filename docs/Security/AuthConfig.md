# 認証・セキュリティ設計（MVP）

## フロー概要
- 方式: OAuth2/OIDC（Authorization Code + PKCE）。IdPは Google / Apple。
- トークン: Access=15分（Bearer）、Refresh=30日（HttpOnly+Secure+SameSite=Lax Cookie）。
- リフレッシュAPI: `POST /v1/auth/refresh`（Cookie必須）。ログアウトは `POST /v1/auth/logout`。
- 公開エンドポイント: `GET /v1/posts*`, `GET /healthz` は `security: []`。

## Cookie/CORS
- Cookie名: `refresh_token`（変更可）。
- Cookie属性: `HttpOnly; Secure; SameSite=Lax; Domain=<COOKIE_DOMAIN>`。
- CORS: `CORS_ALLOWED_ORIGIN` に `http://localhost:3000`, `https://stg.app.posipost.example.com`, `https://app.posipost.example.com` を設定し、`credentials: true` を許可（値はカンマ区切りで複数指定可）。

## CSRF/XSS対策
- CSRF: リフレッシュAPIのみCSRF対策（ダブルサブミットトークンまたはOriginチェック）。
- XSS: アクセストークンはメモリ保持（`localStorage`に保存しない）。

## スコープ/クレーム（例）
- OIDCスコープ: `openid profile email`。
- IDトークンの`email_verified`を参考にユーザー登録/リンク。
- アクセストークンの`sub`はアプリ内ユーザーID（UUID v7）を入れる方針（実装に合わせる）。

## 失敗時の扱い
- 401: 未ログイン/トークン無効→フロントはリフレッシュ試行→失敗時ログインへ遷移。
- 403: 権限不足→権限UIへ誘導。
- 503: 外部障害（スコアリング）→リトライ/案内。

## 環境変数
`docs/ENV_VARS.md` を参照。特にGoogle/Appleのクレデンシャル、Cookieドメイン、CORSオリジンに注意。
