# Architecture

## Runtime topology

```text
Public Internet
  -> Nginx / TLS edge
       -> /*                    Next.js
       -> /api/auth/*           Better Auth inside NestJS
       -> /api/v1/*             NestJS feature controllers
       -> /socket.io/*          NestJS Socket.IO gateway

NestJS API
  -> PostgreSQL/PostGIS through Prisma
  -> disposable Redis cache
  -> critical Redis for BullMQ and Socket.IO adapter
  -> S3-compatible object storage
  -> durable outbox records

NestJS worker
  -> outbox publication
  -> auction close and reconciliation
  -> media verification, malware scan and variants
  -> account deletion
  -> email/notification delivery
  -> integration and cleanup jobs
```

The launch architecture is a modular monolith with independently deployable web, API and worker processes. Business boundaries are extraction-ready without paying the consistency and operational cost of premature microservices.

## Feature-first dependency direction

```text
Next route -> web feature -> shared UI/contracts/http
Nest controller/gateway -> API feature service -> repository/shared infrastructure
Worker processor -> worker feature -> shared queue/database/storage
```

Allowed cross-feature coordination occurs through public feature exports, application orchestration services or versioned domain events. Shared packages never import application features. `apps/web` cannot import `@real-estate/database`.

## HTTP and Query model

- Native `fetch` is the transport.
- `packages/http` resolves browser/internal base URLs, cookies, abort signals, request IDs, idempotency keys and typed errors.
- Feature-local API functions validate responses with Zod.
- TanStack Query owns browser cache, cancellation, infinite pagination, retries and mutation invalidation.
- Server Components call the same NestJS API through the internal Docker URL; interactive pages may hydrate TanStack Query state.
- WebSocket events update Query caches only after event-schema and monotonic-sequence validation.

## Realtime auction rule

A bid is accepted only by a committed PostgreSQL transaction. Socket.IO, Redis and BullMQ deliver the result but do not decide it. A sequence gap causes the browser to refetch the authoritative auction snapshot before applying later events.
