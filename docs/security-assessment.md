# Security and vulnerability assessment

Assessment date: 2026-08-07

## Scope and method

This review covered the application source, feature boundaries, Prisma schema and migrations, authentication integration, authorization guards, account lifecycle, native-fetch boundary, Socket.IO gateway, auction transaction path, BullMQ/outbox workers, object-storage media path, Next.js headers, Nginx routing, Docker definitions, tests and committed configuration. The review used source inspection, targeted insecure-pattern searches, secret scanning, a TypeScript syntax parse, dependency-boundary checks, a Prisma structural/index audit and route/link inspection.

The environment did not contain Bun, Docker or installed dependencies and could not reach package registries. Consequently, transitive dependency auditing, Prisma generation, migrations, compilation, container scanning, dynamic penetration testing, Playwright, Supertest and k6 execution remain release gates rather than completed evidence.

## Findings resolved in this hardening pass

| Severity | Finding | Resolution |
|---|---|---|
| Critical | User uploads intended for public listings were initially placed in a public bucket before malware/type validation. | All originals now upload to a private quarantine prefix. Only worker-reencoded, metadata-stripped variants become public. Rejected and temporary objects are deleted. |
| High | Outbox records could remain indefinitely in `PROCESSING` after a worker crash. | Added leases, stale-claim recovery, bounded attempts, terminal failure state and at-least-once event identifiers. |
| High | Several API/worker settings silently used defaults or raw environment reads. | Added Zod-validated bootstrap configuration and production-only invariants for origin, passkeys, storage, Redis and malware scanning. |
| High | Cookie-authenticated API mutations did not have one consistent same-origin control. | Added a global CSRF origin/fetch-metadata guard while preserving non-cookie service authentication. Better Auth retains its own origin checks. |
| High | Account deletion did not remove user-owned avatar, cover and identity media. | Added idempotent personal-media purge jobs and lifecycle reconciliation. Legally retained transactional records remain pseudonymous. |
| Medium | A public agent link targeted a route that did not exist. | Added the verified-agent directory and corrected profile links to `/users/:id`. |
| Medium | Agent discovery was represented in UI without a complete data path. | Added cursor-ranked API/query/UI flow, search, counts, follow state and database indexes. |
| Medium | Foreign-key relation columns lacked supporting indexes for common delete/join paths. | Added indexes for reviews, areas, bid chains/extensions, settlement participants and moderation reporters. |
| Medium | Next.js server HTTP requests could silently fall back to localhost in production. | Production now requires `API_INTERNAL_URL`; local fallback remains development-only. |
| Medium | Sidebar skeleton width used runtime randomness and could create hydration drift. | Replaced it with deterministic rendering. |
| Medium | Direct workspace dependencies were not comprehensively enforced. | Added a workspace import/dependency-boundary audit and fixed missing declarations. |
| Medium | Container build did not receive all required public Next.js build values. | Added upload and map build arguments to the web image and development Compose build. |
| Medium | CI authentication URLs were inconsistent. | Aligned application and Better Auth origins in CI configuration. |
| Low | Structured logger redaction was too narrow. | Expanded redaction for cookies, authorization, password fields, tokens and response cookies. |

## Security controls present

- First-party, same-origin Better Auth sessions with verified email, password reset, social entry points, passkeys, TOTP/backup codes and session revocation.
- Step-up enforcement for moderator and administrator routes using passkey or credential-plus-2FA session metadata.
- Database-backed role checks, resource policies, active-account checks and immutable audit records for privileged changes.
- Last-super-administrator, self-role-change and self-ban protections under serializable/advisory-lock governance transactions.
- Zod validation at HTTP, WebSocket, worker-job and environment boundaries.
- Parameterized Prisma queries; unsafe raw-query APIs are prohibited by static audit.
- Same-origin CSRF enforcement, security headers, restrictive image origins, exact Socket.IO origin validation and edge rate/connection limits.
- PostgreSQL-authoritative bids with row locking, idempotency, immutable sequence, anti-sniping, transactional outbox and reconciliation.
- Private upload quarantine, bounded stream reads, content signature checks, ClamAV, checksum, dimension limits, EXIF/GPS stripping and public derivative generation.
- Separate cache and critical Redis roles in production topology.
- Secret-file exclusion and source secret-pattern scanning.

## Residual risks and required release verification

1. **Dependency integrity:** `bun.lock` is absent because dependency resolution could not be run. Generate it in a networked environment, commit it and run `bun audit --audit-level=high` plus the configured Socket scanner. Do not release from floating resolution.
2. **Runtime correctness:** Prisma Client generation, PostgreSQL/PostGIS migrations, TypeScript typechecking, Next/Nest builds and all test suites must pass with installed dependencies.
3. **CSP:** Next.js currently requires `'unsafe-inline'` for styles. Replace it with a nonce/hash-based production policy when the final Next.js/shadcn rendering path is verified. Do not add wildcard script or connection origins.
4. **Distributed throttling:** Nginx provides shared edge limits, while the Nest throttler is process-local. For multi-edge or direct-API deployment, use a Redis-backed throttler and provider/WAF controls.
5. **Signed upload size:** presigned PUT is short-lived and post-upload processing has strict byte caps, but the object store receives bytes before rejection. Production should enforce bucket/account quotas and preferably move to presigned POST with `content-length-range` when the target provider is finalized.
6. **OAuth/WebAuthn:** local source tests cover flow initiation and virtual WebAuthn behavior. Real Google/GitHub callbacks and production RP/domain behavior require protected staging credentials and target-browser testing.
7. **Community adapter:** the NestJS Better Auth adapter is third-party. Pin it through `bun.lock`, monitor advisories and maintain integration tests around request-body handling and session decorators.
8. **Retention/legal scope:** message attachments, property ownership evidence, bids, settlements and audit records are intentionally not indiscriminately destroyed. A Nepal-specific privacy, auction, advertising, payment and evidence-retention policy must approve exact periods and deletion behavior.
9. **External providers:** payments, CRM, accounting, identity and email delivery cannot be release-certified until provider contracts, signatures, retries and sandbox callbacks are configured.
10. **Infrastructure validation:** Nginx syntax, Redis ACL/TLS, PostgreSQL privileges, backup restoration, object-store policies, image scanning and deployment during live auctions require runtime exercises.

## Release disposition

The source is materially hardened and suitable for installation and runtime verification. It is not evidence of a vulnerability-free or production-certified deployment until every residual gate above passes in the target environment.
