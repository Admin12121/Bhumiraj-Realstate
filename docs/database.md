# Database design

## Core modeling decisions

`Property` represents the physical asset. `Listing` represents a market offering. One property can be withdrawn, relisted, rented and later auctioned without losing ownership and document history.

Authentication tables follow Better Auth requirements. Application profile, agency membership, identity verification, listing moderation, auction eligibility and account lifecycle are explicit platform models rather than overloaded authentication fields.

Money uses `BIGINT` minor units and is serialized as decimal strings. Timestamps use `TIMESTAMPTZ(3)`. Mutable business records carry versions or status histories. Bids, payments, audit records and outbox events are immutable rather than soft-deleted.

## Query and N+1 policy

- Repositories select only fields required by the response mapper.
- Feed cards fetch cover media, specification, location, agent, optional favorite and auction state in one bounded query.
- Relation counts use database `_count` or maintained counters rather than per-row requests.
- Admin pages batch related counts and use transactions for consistent overview snapshots.
- Prisma `include` is restricted on unbounded relations; large relations have dedicated paginated endpoints.
- Data loaders are introduced only where a request executes repeated independent relation lookups that cannot be expressed as one repository query.

## Pagination

Public feeds use opaque stable cursors:

- newest: `(publishedAt DESC, id DESC)`
- price: `(priceMinor, id)`
- popular: `(favoriteCount DESC, viewCount DESC, publishedAt DESC, id DESC)`
- messages: `(createdAt DESC, id DESC)`

Admin endpoints use bounded `page`/`pageSize` for operator navigation and expose total counts. Page size is capped at 100. Deep exports run as jobs rather than unbounded table requests.

## Index strategy

Indexes cover listing status/order, owner profile feeds, agency listings, favorites, messages, unread conversations, auction sequence/idempotency, notifications, outbox availability and audit chronology. Each new production query requires an `EXPLAIN (ANALYZE, BUFFERS)` review against realistic cardinality before launch.

PostGIS stores an indexed geography point for radius and viewport queries. Exact and public/approximate coordinates are separate. Spatial repositories use parameterized SQL/TypedSQL and indexed `ST_DWithin`/bounding operations.

## Auction transaction

1. Validate authenticated/eligible bidder and idempotency key.
2. Begin Prisma interactive transaction.
3. lock the auction row with `SELECT ... FOR UPDATE`.
4. Re-read database time, current amount, status and end time.
5. Validate increment and anti-sniping policy.
6. Insert immutable bid with unique `(auctionId, sequence)`.
7. Update auction winner, counters, end time and version.
8. Insert outbox event.
9. Commit.

A worker publishes the committed event and reconciles expired auctions from database time.
