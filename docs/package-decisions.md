# Package decisions

## Included

- Bun workspaces/catalogs plus Turborepo for task orchestration.
- Next.js 16/React 19 for server-rendered public content and interactive feature islands.
- NestJS 11 on Node.js LTS for the API, Socket.IO gateway and separate worker application.
- Better Auth for password, social, passkey, TOTP, session and admin identity workflows.
- Prisma 7 with the PostgreSQL driver adapter and customized PostGIS migrations.
- Plain Zod contracts shared by web, API, worker jobs and realtime events.
- Native `fetch`; TanStack Query for browser server-state.
- BullMQ on a critical Redis instance; separate disposable cache Redis.
- S3-compatible storage behind a provider-neutral package.

## Intentionally excluded

- OpenAPI, Swagger, Orval and generated HTTP clients
- Axios
- pnpm
- Drizzle
- Elysia
- class-validator/class-transformer as the application contract model
- Elasticsearch at launch
- microservices at launch

## Version policy

Core framework versions are pinned through the Bun catalog. The first successful installation must produce and commit `bun.lock`. Renovate then proposes grouped, tested upgrades. A package being newest is not enough: updates require official migration-note review and the complete verification matrix.
