# Bhumiraj Estates

Production-oriented real-estate marketplace based on the reviewed Bhumiraj desktop designs and the reusable administration patterns from the agency project. The product includes a social property feed, public profiles, agent workflows, listing moderation, object-storage media, account security, messaging, and PostgreSQL-authoritative live auctions.

## Technology baseline

- Bun workspaces and Turborepo
- Next.js 16 and React 19
- NestJS 11 HTTP API and Socket.IO gateway
- Better Auth: password, verified email, Google/GitHub entry points, passkeys, TOTP/2FA, recovery codes, session management and administrative user management
- Prisma 7 with PostgreSQL 17 and PostGIS
- Zod 4 shared contracts
- Native `fetch` and TanStack Query 5
- Redis for cache, BullMQ and Socket.IO fan-out in local development; production may split cache and durable Redis
- S3-compatible object storage, direct signed uploads, media processing and ClamAV scanning
- Playwright, Jest/Supertest and k6 suites

The application deliberately does not use OpenAPI, Swagger, generated API clients, Axios, pnpm, Drizzle or Elysia.

## Repository

```text
apps/web       Next.js public, account, agent and admin experiences
apps/api       NestJS HTTP API, Better Auth and WebSocket gateway
apps/worker    NestJS BullMQ processors and reconciliation workers
packages/*     Contracts, Prisma, auth, HTTP, queue, Redis, storage and UI foundations
infrastructure Dockerfiles, Nginx, MinIO and environment infrastructure
docs           Architecture, schema, security, testing and runbooks
```

## Full Docker development environment

Bun and Docker are required on the development machine.

```bash
cp .env.example .env
# Replace the placeholder secrets before first start.
docker compose up -d --build
```

Open:

- Application: `http://localhost:8080`
- MinIO console: `http://localhost:9001`

The API container applies Prisma migrations, seeds the local platform admin and bootstraps MinIO buckets before serving. PostgreSQL/PostGIS, Redis, MinIO and ClamAV are local-only dependencies. Local MinIO uses global CORS via `MINIO_API_CORS_ALLOW_ORIGIN`; per-bucket CORS is opt-in with `S3_CONFIGURE_BUCKET_CORS=true` for S3 backends that support it cleanly.

## Host-based application development

Run infrastructure in Docker and applications with Bun only when faster hot reload is required. Override container hostnames with localhost values in the shell before starting the applications.

```bash
bun install
bun run db:generate

docker compose up -d postgres redis minio clamav

export DATABASE_URL='postgresql://estate:estate@localhost:5432/estate?schema=public'
export DIRECT_URL="$DATABASE_URL"
export REDIS_CACHE_URL='redis://localhost:6379/0'
export REDIS_CRITICAL_URL='redis://localhost:6379/0'
export S3_ENDPOINT='http://localhost:9000'
export S3_PUBLIC_ENDPOINT='http://localhost:9000'
export S3_AUTO_SETUP='true'
export S3_CONFIGURE_BUCKET_CORS='false'
export API_INTERNAL_URL='http://localhost:3001'
export CLAMAV_HOST='localhost'

bun run db:deploy
bun run db:seed
bun run dev
```

## Verification commands

```bash
bun install
bun run db:generate
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:api:e2e
bun run test:e2e
```

Commit `bun.lock` after the first successful dependency resolution. CI should use the committed lock with a frozen installation policy after that point.

## Non-negotiable boundaries

1. Next.js never imports Prisma or connects directly to PostgreSQL.
2. PostgreSQL is authoritative for bids, listing state, authorization-sensitive state, payments and account lifecycle state.
3. Redis is cache, queue and realtime transport; it never accepts or selects a winning bid.
4. Features expose a public boundary and never deep-import another feature's internals.
5. Shared Zod contracts validate every untrusted HTTP, job and realtime payload.
6. Public feeds use stable cursor-based infinite pagination. Administrative data tables use bounded indexed pagination.
7. External side effects pass through durable outbox records and BullMQ processors.
8. Sensitive administrative actions are immutable audit events.
9. Public media and private identity/property documents use separate storage policies.
10. Production changes require migrations, tests, backup verification and a rollback plan.

Read `docs/implementation-status.md`, `docs/review-report.md` and `docs/security-assessment.md` before treating the repository as release-certified.
