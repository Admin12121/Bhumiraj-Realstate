# Implementation status

## Implemented

- Feature-first Bun/Turborepo monorepo.
- Shared Zod contracts and native-fetch HTTP boundary.
- Next.js guest/authenticated social home UI, public listing/profile pages, account center and agency-style admin panel.
- Cursor-based listing/profile/message/verified-agent feeds and bounded admin pagination.
- Better Auth password, email verification/reset, Google/GitHub configuration, passkey, TOTP/2FA, backup codes, sessions and admin operations.
- Normalized Prisma/PostgreSQL schema with PostGIS migration, indexes, histories, audit logs, idempotency and outbox tables.
- Private-quarantine direct uploads, bounded verification, MIME/magic-byte checks, checksum, ClamAV scan, EXIF/GPS stripping, public derivatives and deletion-time personal-media purge.
- PostgreSQL-row-locked live bidding, idempotency, event sequence, anti-sniping, leased/recoverable outbox publication, Socket.IO delivery, delayed closing and database reconciliation.
- Docker environments, Nginx same-origin routing, Redis separation, worker, MinIO, Mailpit and ClamAV.
- Browser and API test suites covering the principal account, RBAC, listing, profile, messaging, pagination and auction workflows.

## Release gates still requiring an environment

Dependencies resolve and `bun.lock` is generated locally, but it is not yet committed. Before production deployment, an engineer must execute the full verification matrix on the target Node/Bun/Docker versions:

1. Commit `bun.lock` and switch CI to a frozen installation policy.
2. Run Prisma generation and migrations against disposable PostgreSQL/PostGIS.
3. Run lint, TypeScript, unit, API integration, Playwright and k6 tests.
4. Complete real Google and GitHub OAuth callbacks with dedicated test applications in staging.
5. Verify WebAuthn with target browsers and production RP/domain settings.
6. Verify payment, CRM, accounting, email and identity providers after their credentials/contracts are supplied.
7. Perform load, penetration, restore, failover and live-auction deployment tests.
8. Obtain jurisdiction-specific auction, deposit, privacy, retention and property-advertising approval.

Passing source-level review is not equivalent to passing these runtime release gates.
