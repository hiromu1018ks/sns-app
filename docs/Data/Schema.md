# データスキーマ（MVP / Auth.js + Prisma）

実装のDBに依存しない抽象スキーマです。型は代表例（PostgreSQL）で記載していますが、他RDBでも可。

Auth.js（旧NextAuth.js）をPrisma Adapterで利用するため、Auth.jsの標準モデル（User / Account / Session / VerificationToken）に準拠します。Auth.jsのUserは文字列ID（既定は`cuid()`）のため、APIでUUID v7を一貫させる目的でアプリ層ユーザー`AppUser`（UUID v7）を別に持ち、`User`と1:1対応させます。

参考: Auth.js データモデル（Prisma/SQLの例）をベースにしています（カラム名はsnake_case推奨。Prisma等では`@map`で対応可能）。

## 共通
- `id`: UUID v7（DB型は`uuid`/文字列）。
- 監査列: `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`。
- ソフト削除: `deleted_at TIMESTAMPTZ NULL`（存在時は非表示）。

## Auth.jsユーザ（Prisma Model: `User`）
- `id` PK
- `email TEXT NULL UNIQUE`（Google/Appleでメール非公開の可能性があるためNULL可）
- `name VARCHAR(100) NULL`
- `email_verified TIMESTAMPTZ NULL`
- `image TEXT NULL`
- `created_at`, `updated_at`
- Index: `(email)`

## アプリユーザ（Prisma Model: `AppUser`）
- 目的: API公開IDをUUID v7で一貫させるためのアプリ層ユーザー。
- `id` PK（UUID v7）… APIの`userId`はこちらを返す
- `auth_user_id` FK → `User(id)`（Auth.jsのUserと1:1）
- `created_at`, `updated_at`
- Unique: `(auth_user_id)`

## drafts
- `id` PK
- `user_id` FK → app_users(id)
- `text TEXT NOT NULL` (max 2000)
- `created_at`, `updated_at`, `deleted_at`
- Retention: 90日無操作で削除
- Index: `(user_id, created_at DESC)`

## posts
- `id` PK
- `user_id` FK → app_users(id)
- `text TEXT NOT NULL`
- `score NUMERIC(4,3) NOT NULL` (0.000-1.000)
- `status VARCHAR CHECK (status IN ('approved'))`  — 公開後編集不可
- `created_at`, `deleted_at`
- `restore_deadline TIMESTAMPTZ`（削除後+30日）
- Index: `(created_at DESC)`, `(user_id, created_at DESC)`

## reactions
- `id` PK
- `post_id` FK → posts(id)
- `user_id` FK → app_users(id)
- `type VARCHAR CHECK (type IN ('LIKE','EMPATHY','THANKS','SUPPORT'))`
- `created_at`
- 制約: `UNIQUE(post_id, user_id)` — 同時に1種類のみ（置換はUPDATEで実装）
- Index: `(post_id)`, `(user_id)`

## notifications
- `id` PK
- `user_id` （受信者）FK → app_users(id)
- `actor_user_id` FK → app_users(id)
- `post_id` FK → posts(id)
- `reaction_type` 同上
- `created_at`, `read_at NULL`
- Index: `(user_id, created_at DESC)`

## deletion_queue（バッチ用）
- `id` PK
- `resource_type` ('post','reaction','notification')
- `resource_id` UUID
- `execute_after TIMESTAMPTZ`（30日後）
- Index: `(execute_after)`

## accounts（Auth.js準拠・OAuthアカウントひも付け）
- `id` PK
- `user_id` FK → users(id) ON DELETE CASCADE
- `type VARCHAR(20) NOT NULL`（例: 'oauth'）
- `provider VARCHAR(50) NOT NULL`（'google' | 'apple' 等）
- `provider_account_id TEXT NOT NULL`
- `refresh_token TEXT NULL`（IdP由来のトークンを必要に応じ保持）
- `access_token TEXT NULL`
- `expires_at BIGINT NULL`
- `token_type TEXT NULL`
- `scope TEXT NULL`
- `id_token TEXT NULL`
- `session_state TEXT NULL`
- `created_at`, `updated_at`
- Unique: `(provider, provider_account_id)`
- Index: `(user_id)`

## sessions（Auth.js準拠・オプション）
MVPは「session: 'jwt'」前提（DBセッション不要）ですが、将来の拡張に備えスキーマを記載します。

- `id` PK
- `user_id` FK → users(id) ON DELETE CASCADE
- `session_token TEXT NOT NULL UNIQUE`
- `expires TIMESTAMPTZ NOT NULL`
- `created_at`
- Index: `(user_id)`

## verification_tokens（Auth.js準拠・オプション）
メールマジックリンク等を導入する場合のみ使用。

- `identifier TEXT NOT NULL`
- `token TEXT NOT NULL`
- `expires TIMESTAMPTZ NOT NULL`
- Primary Key: `(identifier, token)`（または`token`にUNIQUE）

## カウンタについて
- 投稿の各リアクション数は都度集計でも問題ない件数規模を想定。必要なら `post_reaction_counters` を導入（`post_id`ごとに4列＋更新トリガ）。

## 備考（ORMマッピング）
- Prismaを使う場合、Auth.jsのサンプルに合わせて`@map`でsnake_caseへマッピング可能。
- 例: `providerAccountId` ⇔ `provider_account_id`、`emailVerified` ⇔ `email_verified` など。

---

## Prisma スキーマ例（PostgreSQL想定）

`prisma/schema.prisma` に置く想定の例です。Auth.jsモデルは公式推奨（cuid()）に準拠、アプリ側はUUID v7（アプリ生成）を採用します。

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// === Auth.js models (keep as-is, cuid IDs) ===
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime? @map("email_verified")
  image         String?
  accounts      Account[]
  sessions      Session[]
  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime
  @@unique([identifier, token])
  @@map("verification_tokens")
}

// === Application models (UUID v7; generate in app code) ===
model AppUser {
  id         String  @id @db.Uuid // v7をアプリで生成してセット
  authUserId String  @unique @map("auth_user_id")
  authUser   User    @relation(fields: [authUserId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  posts      Post[]
  drafts     Draft[]
  reactions  Reaction[]
  @@map("app_users")
}

model Draft {
  id        String   @id @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  user      AppUser  @relation(fields: [userId], references: [id], onDelete: Cascade)
  text      String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")
  @@index([userId, createdAt(sort: Desc)])
  @@map("drafts")
}

model Post {
  id              String   @id @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  user            AppUser  @relation(fields: [userId], references: [id], onDelete: Cascade)
  text            String
  score           Decimal  @db.Decimal(4, 3)
  status          String
  createdAt       DateTime @default(now()) @map("created_at")
  deletedAt       DateTime? @map("deleted_at")
  restoreDeadline DateTime? @map("restore_deadline")
  reactions       Reaction[]
  notifications   Notification[]
  @@index([createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@map("posts")
}

model Reaction {
  id        String   @id @db.Uuid
  postId    String   @map("post_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  type      String
  createdAt DateTime @default(now()) @map("created_at")
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      AppUser  @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([postId, userId]) // 1投稿につき同時に1種類
  @@index([postId])
  @@index([userId])
  @@map("reactions")
}

model Notification {
  id           String   @id @db.Uuid
  userId       String   @map("user_id") @db.Uuid // 受信者
  actorUserId  String   @map("actor_user_id") @db.Uuid
  postId       String   @map("post_id") @db.Uuid
  reactionType String   @map("reaction_type")
  createdAt    DateTime @default(now()) @map("created_at")
  readAt       DateTime? @map("read_at")
  user         AppUser  @relation("NotificationReceiver", fields: [userId], references: [id], onDelete: Cascade)
  actorUser    AppUser  @relation("NotificationActor", fields: [actorUserId], references: [id], onDelete: Cascade)
  post         Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt(sort: Desc)])
  @@map("notifications")
}

model DeletionQueue {
  id           String   @id @db.Uuid
  resourceType String   @map("resource_type")
  resourceId   String   @map("resource_id") @db.Uuid
  executeAfter DateTime @map("execute_after")
  @@index([executeAfter])
  @@map("deletion_queue")
}
```

### UUID v7の扱い
- Prismaの`@default(uuid())`はv4のため、v7はアプリコードで`uuid`ライブラリ（v9以降）の`v7()`を用いて明示設定してください。
- DB拡張で`uuid_v7()`等が提供される場合は `@default(dbgenerated("uuid_v7()"))` を使用可能です（環境依存）。
