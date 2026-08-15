# Operations runbook

## Deployment

1. Resolve from committed `bun.lock`; run lint, typecheck, unit, API, browser and load gates.
2. Generate Prisma Client and verify migrations on a restored production-like snapshot.
3. Build immutable web/API/worker images and scan them.
4. Verify encrypted PostgreSQL backup and point-in-time recovery position.
5. Run `prisma migrate deploy` as one release job.
6. Deploy worker, then API, then web; verify readiness before shifting traffic.
7. Monitor error rate, PostgreSQL connections/locks, outbox age, BullMQ lag, Socket.IO connections, media rejection, accepted/rejected bid rate and auction-close drift.

Never use `prisma db push` or `prisma migrate dev` in production. Migrations must be backward compatible with the previous application during rolling deployment.

## Rollback

Application rollback uses the prior immutable images. Do not automatically reverse a migration containing user data changes. Prefer expand/migrate/contract releases; execute a reviewed forward repair when schema rollback is unsafe.

## Auction incident

- Preserve PostgreSQL as authority; do not reconstruct winners from Redis.
- Pause affected auction through audited admin operation when integrity is uncertain.
- Capture transaction errors, lock waits, event sequence and outbox state.
- Reconcile auction snapshot from bids inside a transaction.
- Resume or void only under approved policy and notify participants.

## Redis outage

API writes that require Redis fan-out may commit database/outbox state and return success. The worker retries publication after recovery. Disable nonessential cache usage; never manually alter winning state in Redis.

## Media/ClamAV outage

Uploads remain non-public in `UPLOADED`/`PROCESSING`. Production workers fail closed when ClamAV is unavailable. Restore scanning, retry jobs, review rejected objects and never mark an unscanned object READY manually.

## Backup and restoration

Test full and point-in-time PostgreSQL restoration, object version restoration and Redis critical recovery on a schedule. A backup is not considered valid until a restore and application integrity check succeeds.
