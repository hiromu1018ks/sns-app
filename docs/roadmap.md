# 開発ロードマップ（MVP）

本ロードマップは、docs/ 配下の合意済み仕様（Requirements.md / Openapi.yaml / TechStack.md / Data/Schema.md / Security/AuthConfig.md / ENV_VARS.md / README.dev.md / API 配下ドキュメント）を前提に、実装を止めない順序で進める作業計画をまとめたものです。学習と実務の両立を意識し、短いサイクルで価値を出す構成にしています。

## 0. ゴール/前提
- ゴール: ポジティブ投稿のみ公開可能なSNSのMVPを、公開閲覧可・認証必須の投稿/リアクション付きで提供。
- 認証: Auth.js（Google/Apple, PKCE）。Access=15分（Bearer）、Refresh=30日（HttpOnly Cookie）。
- 公開/権限: 投稿閲覧は非ログイン可、作成/リアクション/通知はログイン必須。
- データ: Auth.js(User/Account/Session/VerificationToken) + AppUser(UUID v7)。投稿等はAppUser基準。
- インフラ: Web=Vercel、API=Fly.io、DB=Neon、Redis=Upstash系。

## マイルストーン一覧（ハイレベル）
1) リポジトリ/開発基盤の整備（モノレポ、型/品質）
2) データ層（Prisma + Neon）と最小起動
3) 認証（Auth.js + セッション境界）
4) 公開閲覧API（/healthz, /v1/posts GET, /v1/posts/{id} GET）
5) ドラフト→公開フロー（スコアリングはダミー）
6) スコアリング統合（Gemini, タイムアウト/再試行）
7) リアクション/通知
8) 非機能（RateLimit, 429, ログ, 監査/保持, 削除/復元ジョブ）
9) フロント実装（ログイン～タイムライン～作成/公開/提案表示）
10) テストとSLO検証（Unit/E2E/負荷）→ リリース

---

## Sprint 0: プロジェクト初期化（1～2日）
- モノレポ雛形: `web/`（Next.js App Router）, `api/`（Fastify）
- 共通: pnpm, TypeScript設定, ESLint/Prettier, tsconfig共有, scripts
- OpenAPIから型生成: `pnpm gen:api-types`（openapi-typescript, openapi-fetch）
- docs/ に追従: RouteMapの右欄に実装ファイル名を記入
- 完了条件:
  - `pnpm dev`でwebとapiがローカル起動（/healthz 200）
  - 型生成が通り、ビルド/リント/テスト（空）がGreen

## Sprint 1: データ層（Prisma + Neon）と最小起動（1～2日）
- Prisma設定: `prisma/schema.prisma` を Data/Schema.md の例から作成
  - Auth.jsモデル（User/Account/...=cuid）、AppUser/Posts/…（UUID v7: アプリ生成）
- マイグレーション: `prisma migrate dev`（ローカル）、Neonでも適用
- .env整備: DATABASE_URL ほか、.env.example で値確認
- 完了条件:
  - ローカルDBでマイグレーション成功、基本テーブル生成
  - APIからDB接続が成功（/healthz内で簡易チェック）

## Sprint 2: 認証（Auth.js + セッション境界）（2～3日）
- Web側: Auth.js（Google/Apple）セットアップ（JWT戦略）。初回サインイン時にAppUser作成。
- API側: Refresh/Logout 実装（Openapi.yaml: /v1/auth/refresh, /v1/auth/logout）
- セッションブートストラップ（設計）:
  - 選択肢A: Webのサインイン完了後、IdPのIDトークンをAPIへPOSTしてRefresh Cookieを発行（`/v1/auth/bootstrap` 追加を検討）
  - 選択肢B: Web→APIの専用ハンドシェイクをAuth.jsコールバック内で行い、API側がユーザーを確定
  - どちらかを採用し、必要ならOpenAPIを追記
- CORS/Cookie: `credentials: include`、許可オリジン3つ、Cookie属性を環境に合わせて設定
- 完了条件:
  - WebでGoogle/Appleでログイン→APIの認証付きエンドポイントへBearerでアクセス可能
  - 未認証時は401、Refresh経由で再発行→成功

## Sprint 3: 公開閲覧API（1～2日）
- 実装: `GET /v1/posts`（公開, security: []）, `GET /v1/posts/{postId}`（公開）
- ページネーション: cursor型（OpenAPIの`oneOf: string|null`に準拠）
- ダミーデータ/Seed: タイムライン表示確認用に数件投入
- 完了条件:
  - 匿名GETが200、CORS越しにWebから取得できる

## Sprint 4: ドラフト→公開（スコアリングはダミー）（2～3日）
- 実装: `POST /v1/drafts`, `GET/PATCH/DELETE /v1/drafts/{id}`, `POST /v1/drafts/{id}:publish`
- 直接投稿: `POST /v1/posts`（ブロック時は400で提案）
- 提案チェックAPI（保存なし）: `POST /v1/text:score`（この段階ではスタブ）
- ステータス/削除: `DELETE /v1/posts/{id}`（ソフト削除, 404ポリシー）, `POST /v1/posts/{id}:restore`
- 完了条件:
  - しきい値をモックで判定し、未達は400+提案、達成は201+Location

## Sprint 5: スコアリング統合（Gemini）（2～3日）
- 実装: Geminiクライアント、Timeout=1000ms、Retry（最大2, exponential）
- 運用しきい値=0.70（x-operational-policies）
- 例外時: 503ハンドリング、フォールバックメッセージ
- 完了条件:
  - 実APIでスコア/提案が返却、閾値未満で公開不可

## Sprint 6: リアクション/通知（2～3日）
- リアクション: `POST /v1/posts/{id}/reactions`（1種類のみ、置換/冪等）、`DELETE`（タイプ不要）
- 通知: `GET /v1/notifications`（自分宛、カーソル）
- `myReaction` を PostResponse に反映
- 完了条件:
  - 付与・置換・取消の一連の挙動がAPI/E2Eで確認できる

## Sprint 7: 非機能/運用（2～3日）
- RateLimit: fastify-rate-limit + Redis（匿名: IP、認証: userId）
- 429レスポンス+RateLimitヘッダ、Idempotency-Key対応（書き込み系）
- ロギング: Pino(JSON), 主要イベント（公開失敗/429/503）
- ジョブ: 30日後ハード削除、下書き90日清掃（BullMQ or pg_cron）
- 監査/保持: 要件通りの保持期間をジョブと設定に反映
- 完了条件:
  - レート上限/保持/削除ジョブが動作し、主要ログが出力

## Sprint 8: フロント実装（3～5日）
- 画面: ログイン導線、タイムライン、詳細、作成（下書き保存/提案チェック/公開）、通知
- エラーUI: 400（提案表示）, 401（再ログイン誘導）, 429（待機/案内）, 503（再試行案内）
- 型安全: OpenAPI生成型でクライアント実装、`credentials: include` 対応
- 完了条件:
  - 基本ユーザーフロー（作成→公開→閲覧→反応→通知）がUI上で完了

## Sprint 9: テスト/SLO/リリース（3～5日）
- Unit: Vitest（web/api）・Supertest（api）
- E2E: Playwright（主要フロー）
- Contract: OpenAPI差分チェック（PRで自動）
- 負荷: k6（p95 1.5s達成、RateLimit/スコアリングSLO確認）
- CI/CD: GitHub ActionsでPR/Preview、本番デプロイ、手動Gate付きmigrate
- 完了条件:
  - SLOを満たし、mainデプロイで初回リリース

---

## 横断タスク（随時）
- ドキュメント追従: 仕様変更は Openapi.yaml → 生成型 → 実装 → README.dev の順で反映
- セキュリティ: CORS/CSRF/ヘッダ/Secrets運用見直し、Auth.jsのProvider設定更新
- 監視/分析: Sentry/外形監視（後追いでも可）

## リスクと対策
- 認証境界の整合: WebのAuth.jsセッションとAPIトークンの橋渡し（/v1/auth/bootstrap 等）を早期に確定し、OpenAPIへ追記。
- スコアリング外部障害: 503の頻度上昇に備え、ユーザー向け案内/再試行ポリシー/一時的フォールバック（公開保留）を準備。
- RateLimit調整: 初期値（docs準拠）をメトリクス見ながら運用で調整。
- UUID v7生成: Prismaはv7のデフォルト非対応。アプリ生成（uuid v9+）かDB拡張で対応。

## 受け入れ基準（Definition of Done）
- 非ログイン閲覧が可能で、ログイン後の作成→公開→閲覧→反応→通知が一通り完了できる
- スコア判定で閾値未満は公開不可となり、提案が表示される
- p95 1.5s以内、429/503/400系の期待動作、30日削除/90日清掃が有効
- OpenAPIと実装が一致（型生成が成功し、E2E/ContractテストがGreen）

## 参照
- 要件: docs/Requirements.md
- API仕様: docs/Openapi.yaml
- 技術選定: docs/TechStack.md
- スキーマ: docs/Data/Schema.md
- 認証/CORS/Cookie: docs/Security/AuthConfig.md
- 環境変数: docs/ENV_VARS.md / .env.example
- 開発ガイド: docs/README.dev.md / docs/API/RouteMap.md / docs/API/ErrorCodes.md
 - Prisma運用注記: スキーマは `api/prisma/schema.prisma` に配置し、`pnpm --filter api exec prisma <command> --schema ./prisma/schema.prisma` で実行
