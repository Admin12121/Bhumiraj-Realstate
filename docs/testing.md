# Testing strategy

## Commands

```bash
bun run test             # unit suites across workspaces
bun run test:api:e2e     # NestJS/Supertest integration suite
bun run test:e2e         # Playwright browser suite
k6 run load-tests/live-bidding.k6.js
```

Tests requiring PostgreSQL, Redis, object storage, email or WebAuthn must run against disposable/isolated infrastructure. Do not replace PostgreSQL locking or PostGIS behavior with SQLite mocks.

## Browser coverage

- sign-up, email verification, password login/logout and password reset
- TOTP enrollment/challenge/recovery behavior
- passkey registration, rename, authentication and deletion using Chromium virtual authenticators
- Google/GitHub initiation locally and real callback smoke tests in protected staging
- session inventory/revocation
- profile/avatar/cover lifecycle, follow and messaging
- user creation through post-property, upload, submit, moderation, publication and deletion request/cancellation
- admin RBAC, user role/ban lifecycle, listing moderation and bounded pagination
- public cursor infinite scroll
- live auction snapshot, bid submission, outbid update, anti-sniping event and reconnect reconciliation

## Auction invariants

- unique `(auctionId, sequence)`
- unique bidder idempotency key per auction
- winning amount equals the highest committed accepted bid
- invalid increments and late bids do not create bid/outbox records
- Redis, gateway or worker failure does not roll back committed bids
- only database time controls extension and closing
- delayed close jobs are corrected by periodic database reconciliation

## External-provider boundary

Real OAuth, payment, CRM, accounting, identity and email-provider completion cannot be deterministic without dedicated sandbox credentials. Local tests verify contract, signature and redirect behavior; staging performs provider-owned end-to-end smoke tests.
