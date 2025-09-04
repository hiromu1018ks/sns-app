# Tech Stack Decisions (MVP)

Date: 2025-09-03

This document records stack choices as we make them, aligned with real‑world practices. Version numbers are kept as “latest stable” to avoid drift; pin exact versions in package.json.

## Repository Layout
- Monorepo with pnpm (Turborepo optional later)
- Projects:
  - `web`: Next.js (App Router), Auth.js
  - `api`: Fastify, Prisma, Zod

## Web (frontend)
- Framework: Next.js (latest stable)
- Auth: Auth.js (NextAuth v5 系)
- Language: TypeScript
- Node: LTS (latest)
- API typings: openapi-typescript from `docs/Openapi.yaml`
- API client: openapi-fetch or lightweight fetch wrapper

## API (backend)
- Runtime: Node.js LTS (latest)
- HTTP: Fastify (latest stable)
- Validation: Zod (+ fastify-type-provider-zod)
- ORM: Prisma (latest stable)
- AuthZ: Bearer Access Token (15m) / Refresh Cookie (30d) — per Requirements
- Logging: Pino (JSON)

## Database
- PostgreSQL (managed)
- Vendor: Neon (serverless Postgres; branch/preview friendly)

## Caching / Jobs
- Redis（managed, e.g., Upstash）
- Use cases: rate limit (anonymous IP / authed user), job queues (30-day delete, 90-day draft cleanup)

## Hosting
- Web (Next.js): Vercel (Preview/Production)
- API (Fastify): Fly.io（staging/production）
- DB: Neon
- Redis: Upstash or equivalent managed

## Testing
- Unit: Vitest（web/api） + Testing Library（web）
- API: Supertest（api）
- E2E: Playwright（web↔api）
- Contract: OpenAPI schema diff + type generation check
- Load (pre‑launch only): k6（主要SLOとRateLimit挙動確認）

## CI/CD
- Platform: GitHub Actions
- Pull Request pipeline:
  - install → lint → typecheck → test → prisma validate → build → OpenAPI diff & typegen check
- Preview:
  - Web: Vercel Preview
  - API: Fly.io staging
  - DB: Neon branch DB（自動）
- Release (main):
  - Web deploy to Vercel production
  - API deploy to Fly.io
  - DB migrate（手動承認ゲート）

## Notes
- Env vars: see `docs/ENV_VARS.md` and `.env.example`
- Schema: see `docs/Data/Schema.md`（Auth.js + Prisma + AppUser(UUID v7)）
