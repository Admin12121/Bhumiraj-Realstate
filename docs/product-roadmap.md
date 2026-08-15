# Bhumiraj Estates product roadmap

Status: living product plan. Application code should be changed one reviewed section at a time as detailed requirements and reference code are supplied.

## Product definition

Bhumiraj Estates is a public-first real-estate network for Nepal. Properties are presented and discovered like social-media posts rather than traditional catalogue rows. Anyone may browse published property posts. Signed-in customers may publish properties for sale or rent, save and follow content, express interest, and participate in eligible auctions.

The platform mediates serious buyer/renter interest through platform-appointed agents. Agents are distinct from application staff and cannot self-register as agents. Application staff are created and authorized through the administration system. A single owner authority controls the platform.

Desktop uses a persistent left navigation sidebar and an optional contextual right rail. Small screens use a persistent bottom navigation dock, mobile header, and single-column feed.

## Product and security rules

- Public browsing never requires an account; only actions that change state require authentication.
- A property post is the social presentation of a real `Property` and `Listing`; those domain records remain separate for ownership, moderation, history, auctions, and future transactions.
- Customer, agent, staff, and owner are separate actor types. Agent status must not be treated as a staff permission.
- Staff authorization is permission-based. Staff roles are named bundles of granular permissions, not hard-coded conditionals scattered through controllers and pages.
- Agents and staff are created or invited only by authorized administration users. Public signup always creates a customer account.
- The owner has every platform permission and may override normal business permissions, but cannot bypass authentication, strong-authentication requirements, immutable audit logging, database integrity, or financial/auction invariants.
- Sensitive operations use deny-by-default server authorization. Hiding a control in the UI is never the authorization mechanism.
- An agent rating is allowed only after a real, completed assignment. Unrelated users cannot rate an agent.
- Agent replacement is a reviewed workflow with a reason, evidence/history, decision, and audit trail; it is not a direct client-side reassignment.
- PostgreSQL is authoritative for auctions and permissions. Redis and WebSockets distribute state but never decide a bid winner or grant access.
- Auction eligibility is evaluated from a versioned policy snapshot so an administrator changing global requirements does not silently alter a live auction.
- All staff, agent, KYC, assignment, auction-participant, and owner actions that affect trust or access are audited.

## Alignment with the current repository

| Area                        | Status                              | Assessment and direction                                                                                                                                                                                                                                                                                      |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public guest browsing       | Aligned                             | Published listing feeds and details already support optional authentication. Preserve and verify every discovery route as guest-accessible.                                                                                                                                                                   |
| Social property feed UI     | Partially aligned                   | The desktop home closely follows the supplied concepts: sidebar, hero, categories, filters, feed, map, and agent rail. It still behaves mainly like a listing catalogue and lacks a complete social interaction model.                                                                                        |
| Desktop left sidebar        | Aligned/ongoing                     | A persistent collapsible sidebar exists and has recent uncommitted work. Finish it after navigation and actor capabilities are finalized.                                                                                                                                                                     |
| Mobile bottom dock          | Phase 2 implemented                 | Public, account, and permission-filtered staff surfaces now use a persistent safe-area-aware dock below 800px, with four primary destinations and a COSS overflow drawer. Desktop keeps the persistent sidebar.                                                                                                 |
| Customer signup/login       | Mostly aligned                      | Better Auth password, social login, passkey, 2FA, recovery, and sessions exist. Public signup must be explicitly constrained to customer accounts.                                                                                                                                                            |
| Actor and RBAC model        | Foundation implemented              | Authentication now uses four fixed account types (`OWNER`, `STAFF`, `AGENT`, `USER`). Only staff receive custom RBAC roles; agents remain outside staff authorization.                                                                                                                                        |
| Staff management            | Phase 1 implemented                 | Authorized staff can promote or invite customers, assign custom roles atomically, suspend/reactivate/revoke membership, terminate sessions, and manage permission bundles within hierarchy and grant-scope limits.                                                                                            |
| Owner authority             | Transfer implemented                | The database enforces a single owner. Explicit transfer requires the current strongly authenticated owner, an active verified staff target with 2FA, fallback roles, a typed confirmation, one serializable transaction, session revocation, and audit. Emergency recovery remains an offline incident procedure. |
| Agent directory/profile     | Lifecycle implemented               | Admin-only create/invite, pending approval, suspension, terminal retirement, availability, and capacity are implemented separately from staff RBAC. Service areas and assignment enforcement belong to the later agent-mediated journey.                                                                        |
| Property posting            | Mostly aligned                      | A listing wizard, property/listing separation, media, moderation, price/status history, sale/rent/auction types, and Nepal-oriented fields exist. The supplied post structure will determine the replacement UI and final validation.                                                                         |
| Post engagement             | Mostly not started                  | Favorites and view counts exist; comments, reactions/likes, share tracking, follow-feed behavior, moderation, and notification rules do not.                                                                                                                                                                  |
| Continue with property      | Not started                         | There is direct messaging/inquiry behavior, but no governed interest/case workflow that requires an agent selection before proceeding.                                                                                                                                                                        |
| Agent selection             | Not started                         | There is no case-specific shortlist, ranked discovery, selection, acceptance, assignment history, or conflict/capacity check.                                                                                                                                                                                 |
| Agent replacement           | Not started                         | No replacement request, reason, review, decision, reassignment, or escalation workflow exists.                                                                                                                                                                                                                |
| Agent ratings               | Schema only                         | Basic reviews and rating aggregates exist, but reviews are not tied to completed assignments and lack the required API/UI and abuse controls. The current schema should be tightened rather than exposed directly.                                                                                            |
| Messaging                   | Partially aligned                   | Conversations and messages exist. They must become participants in the property-interest/agent-assignment workflow and receive stronger realtime and moderation verification.                                                                                                                                 |
| Voice/video calls           | Not started                         | No call signaling, media provider/WebRTC design, consent, abuse controls, or call records exist. Treat calls as a later independent feature.                                                                                                                                                                  |
| Auction core                | Strong partial alignment            | Database locking, idempotent bids, realtime sequencing, anti-sniping, registration, reconciliation, and settlement foundations exist. This is a valuable base to retain.                                                                                                                                      |
| Auction verification policy | Partially aligned                   | Email, verified phone, optional KYC, and deposit state are considered. Required 2FA and fully configurable per-auction criteria are missing.                                                                                                                                                                  |
| Auction participant control | Mostly not started                  | Registration states exist, but participant list management, manual add/remove/update, reasons, overrides, VIP passes, revocation, and complete audit UX are missing.                                                                                                                                          |
| Auction experience          | Partially aligned                   | Live snapshot, bid history, and realtime UI exist. Pre-event lobby, participant presence, leaderboard rules, completion animation, winner ceremony, reconnection UX, and operator controls require focused work.                                                                                              |
| Media storage/processing    | Aligned foundation                  | S3-compatible storage, quarantine, validation, malware scanning, variants, and cleanup exist. Video-specific limits/transcoding and production verification remain.                                                                                                                                           |
| Admin application           | Partially aligned                   | There are users, agents, listings, auctions, moderation, audit, messages, settings, and overview surfaces. They are broad but shallow and must be rebuilt around staff permissions and operational workflows.                                                                                                 |
| Scale and operations        | Good foundation, partially verified | API/worker separation, Redis, BullMQ, Socket.IO fan-out, outbox, Docker, Nginx, and load-test scaffolding are appropriate. The monorepo lint, type-check, unit tests, production build, static audit, local migrations, and health endpoint are verified; realistic 1,000+ participant auction tests are not. |

## Concepts to retain, replace, and introduce

### Retain and improve

- Next.js, Better Auth, TanStack Query, NestJS, Prisma/PostgreSQL/PostGIS, Redis, Socket.IO, BullMQ, and S3-compatible storage.
- Modular monolith with separate web, API, and worker runtimes.
- Existing `Property` plus `Listing` separation, cursor feeds, media pipeline, moderation history, outbox, audit log, and database-authoritative auction transaction.
- Current desktop visual direction from `dfsdf.png` and `ttt.png`.

### Replace or redesign

- Single `User.role` authorization model.
- Fixed role checks repeated through guards, controllers, contracts, and frontend pages.
- Treating the listing creator as the effective listing agent.
- Direct message/inquiry as the only path for continuing a property deal.
- Mobile sidebar-sheet behavior as the primary mobile navigation.
- Agent review uniqueness based only on author and agent; reviews must be assignment-backed.
- Broad implementation-status claims that are not backed by passing runtime checks.

### Introduce

Names are provisional until each section is specified in depth.

- `StaffRole`, registered `StaffPermission`, role-permission assignment, and multi-role staff membership/lifecycle.
- Explicit owner authority and controlled owner recovery/transfer procedure.
- Agent onboarding/invitation, status, service areas, availability/capacity, and verification history.
- Property social interactions: comments/replies, reactions, share events, following, moderation, and notification preferences.
- A property-interest case connecting interested customer, property owner/listing, assigned agent, status, and timeline.
- Agent shortlist/selection, assignment acceptance, replacement requests, decisions, and assignment history.
- Assignment-backed agent feedback and rating eligibility.
- Versioned verification policies and per-auction eligibility snapshots.
- Auction participant operations, overrides, access passes, reasons, expiry/revocation, and audit events.
- Responsive application shell with desktop sidebar and mobile bottom dock.

## Ordered implementation TODO

### Phase 0 — Stabilize and protect the baseline

- [x] Preserve and identify the existing uncommitted frontend/infrastructure changes before feature edits.
- [x] Correct workspace dependency/tool availability so lint, type-check, unit tests, and builds run consistently.
- [x] Fix the static audit scope so generated Prisma output and the audit script itself do not create false positives.
- [x] Resolve the real unsafe casts already reported in admin controllers.
- [x] Establish a disposable local integration environment and record one verified baseline run.
- [x] Add a small architecture decision log and update implementation status from evidence, not file presence.
- [x] Define migration and compatibility rules before changing user roles or existing data.

Exit condition: the current application builds and has a trustworthy automated baseline before foundational schema changes begin.

### Phase 1 — Finalize actors, staff RBAC, and owner governance

- [ ] Review the detailed customer/staff/agent/owner rules with the supplied examples.
- [x] Separate fixed customer, agent, staff, and owner account types; keep agent profiles/status outside staff RBAC.
- [x] Define a granular permission catalogue grouped by administration domain and action.
- [x] Define custom staff roles as editable permission bundles with hierarchy and grant-scope protection.
- [x] Implement promotion from an active customer, multi-role assignment, revocation, and session termination.
- [x] Implement staff invitation plus explicit active/suspended/revoked lifecycle workflows.
- [x] Implement admin-only agent create/invite, approve, suspend, retire, and availability workflows.
- [x] Make public signup always create only a customer identity.
- [x] Implement deny-by-default API permission guards and hierarchy/grant-scope policy checks.
- [x] Make the frontend consume capabilities returned by the server rather than infer access from role names.
- [x] Add immutable audits for role, permission, staff-membership, account-type, and owner-transfer actions.
- [x] Add owner strong-authentication and single/last-owner protection.
- [x] Implement the explicit owner-transfer ceremony and operational recovery runbook without a runtime recovery backdoor.
- [ ] Finalize emergency owner replacement and dual-control policy after the owner supplies the required governance rules.
- [x] Migrate existing `AGENT`, `MODERATOR`, `ADMIN`, and `SUPER_ADMIN` accounts safely.
- [x] Add authorization guard unit tests including hierarchy and privilege-escalation attempts.
- [x] Add database-backed authorization and lifecycle integration coverage.
- [ ] Add browser tests for every staff operation after the detailed staff rules and final page behavior are approved.

Exit condition: all later admin and agent features can rely on one correct authorization foundation.

### Phase 2 — Responsive social application shell

- [x] Use the supplied guest and authenticated concepts as the desktop visual baseline.
- [x] Finalize desktop sidebar information architecture for guest and signed-in states.
- [x] Implement the mobile header and persistent bottom dock with safe-area support.
- [x] Define bottom-dock primary actions and an overflow destination; avoid squeezing every desktop item into the dock.
- [x] Make public, account, and permission-filtered staff shells intentionally distinct while sharing design and navigation tokens.
- [ ] Define the dedicated signed-in agent workspace shell after the agent workflow requirements are approved.
- [x] Finish responsive feed widths, right-rail visibility, touch targets, keyboard behavior, loading, empty, error, and offline/reconnect states.
- [x] Establish the accessibility baseline: landmarks, skip link, current-page state, focus-visible controls, minimum touch targets, reduced motion, status announcements, and COSS drawer behavior.
- [ ] Complete contrast and screen-reader audits across authenticated account and staff pages when browser fixtures are enabled.
- [x] Add responsive browser coverage at phone, the 799/800px boundary, and desktop sizes.
- [ ] Add stable image baselines at tablet and wide-desktop sizes after representative seeded listing data is approved.

Exit condition: navigation and shell behavior are stable before individual feature screens multiply.

### Phase 3 — Property posts and discovery

- [ ] Review the supplied post structure and detailed property-type requirements.
- [ ] Define one canonical property-post contract with type-specific specifications for room, apartment, house, land, villa, commercial, and future types.
- [ ] Decide draft, preview, submit, moderation, publish, edit, relist, withdraw, archive, and delete behavior.
- [ ] Implement strict server and client validation, including Nepal address/area units and sale/rent rules.
- [ ] Complete image/video upload ordering, covers, captions/alt text, limits, progress, retry, and processing states.
- [ ] Rebuild the composer to feel like creating a social post while retaining structured real-estate data.
- [ ] Finish public feed, search, filters, sorting, maps, property detail, author profile, and related-property behavior.
- [ ] Add ownership proof and listing verification workflow without exposing exact/private property data publicly.
- [ ] Add post comments/replies, reactions, share tracking, saves, follows, counts, reporting, moderation, and notifications.
- [ ] Define feed ranking signals and keep an explicit chronological option; do not begin with opaque personalization.
- [ ] Add abuse limits, spam controls, idempotency, pagination, cache policy, and feed performance tests.

Exit condition: a guest can discover and inspect posts, and a customer can safely publish and manage a complete property post.

### Phase 4 — Property interest and agent-mediated journey

- [ ] Define the exact meaning and allowed states of the `Continue` action.
- [ ] Create a property-interest case with immutable participants and timeline history.
- [ ] Prevent owners from opening an interest case on their own listing and prevent duplicate active cases.
- [ ] Build agent discovery by service area, property type, language, rating, verified status, availability, capacity, and conflict rules.
- [ ] Support selecting a known agent or choosing from recommended agents.
- [ ] Define whether agents must accept assignments and what happens on timeout/decline.
- [ ] Move case conversation access behind a valid assignment and participant policy.
- [ ] Build owner, interested customer, agent, and authorized staff case views.
- [ ] Implement agent replacement request with reason, optional evidence, review, decision, notification, and reassignment history.
- [ ] Define completion/cancellation/dispute states and who may transition each state.
- [ ] Permit agent ratings only after qualifying completion, one per case/side as decided, with moderation and recalculation.
- [ ] Add service-level timers, assignment/replacement metrics, and complete audit coverage.

Exit condition: expressing serious interest always produces a controlled, auditable agent-mediated workflow.

### Phase 5 — Identity and configurable verification

- [ ] Define customer verification levels and the exact evidence required for each level.
- [ ] Complete email, phone OTP, 2FA, identity/KYC submission, review, rejection, resubmission, expiry, and revocation flows.
- [ ] Store sensitive documents privately with least-privilege access, retention, deletion, and access auditing.
- [ ] Create reusable, versioned policy evaluation for feature eligibility.
- [ ] Let authorized staff configure allowed requirements within safe platform-defined bounds.
- [ ] Show customers a clear checklist explaining why an action is locked and how to qualify.
- [ ] Add step-up authentication for sensitive customer, agent, staff, auction, and owner actions.

Exit condition: auction and high-trust workflows can consume a consistent verified eligibility decision.

### Phase 6 — Auction operations and realtime experience

- [ ] Review detailed auction creation, approval, scheduling, bidding, winner, settlement, and cancellation rules.
- [ ] Preserve and test the existing PostgreSQL row-locking, bid idempotency, monotonic event sequence, outbox, anti-sniping, and reconciliation design.
- [ ] Make duration, advance publication, increment, reserve, anti-sniping, deposit, participant cap, and verification policy explicit per auction.
- [ ] Snapshot eligibility policy when registration opens and define controlled policy-change behavior.
- [ ] Enforce required verified email, phone, 2FA, KYC level, deposit, and any future criteria at registration and again before bid acceptance.
- [ ] Build participant list/search/detail, approve/reject, manual add, remove, suspend, reinstate, notes, and bulk operations with reasons.
- [ ] Implement scoped auction access passes/VIP passes with issuer, auction, permissions, validity, revocation, usage, and audit history.
- [ ] Build pre-auction lobby, countdown, connection/presence indicators, bid controls, authoritative leaderboard, history, and reconnect/catch-up behavior.
- [ ] Define privacy-safe participant identities and exactly what leaderboard data is public.
- [ ] Add pause/resume/extend/end/void emergency controls protected by strong authentication and confirmation.
- [ ] Build winner completion animation with reduced-motion alternative and server-confirmed result only.
- [ ] Complete settlement/deposit behavior only after payment and legal requirements are supplied.
- [ ] Load-test realistic 50, 100, 500, and 1,000+ connected users, burst bidding, reconnect storms, multiple API instances, Redis interruption, worker delay, and database failover.
- [ ] Define capacity limits, backpressure, rate limits, metrics, alerts, dashboards, and operator runbooks from measured results.

Exit condition: an auction is administratively controllable, eligibility-safe, database-authoritative, recoverable, and proven at the agreed concurrency target.

### Phase 7 — Messaging, notifications, and optional calls

- [ ] Align listing, interest-case, agent, direct, and support conversation types with explicit participant policies.
- [ ] Add realtime delivery receipts, unread state, typing/presence only where valuable, reconnect/catch-up, attachments, blocking, reporting, and retention.
- [ ] Implement in-app/email/push/SMS preference and delivery rules without notification spam.
- [ ] Measure Socket.IO room, Redis adapter, API instance, and database behavior independently from auction traffic.
- [ ] Decide whether calls are required for launch.
- [ ] If required, select WebRTC/provider architecture and define signaling, TURN, consent, safety, moderation, metadata retention, and cost controls before UI work.

Exit condition: communications are scoped to valid relationships, abuse-resistant, and do not threaten bidding traffic.

### Phase 8 — Administration and operations completion

- [ ] Rebuild navigation and page access from server-provided staff capabilities.
- [ ] Provide searchable, paginated operational tables with detail drawers for users, staff, agents, properties, cases, KYC, auctions, reports, and audits.
- [ ] Add dual control/approval for the most sensitive owner, permission, auction, and financial operations where appropriate.
- [ ] Add reason-required destructive decisions, previews, confirmations, reversible states where possible, and immutable audit history.
- [ ] Add operational queues, assignments, SLA indicators, saved filters, exports with permission checks, and safe redaction.
- [ ] Finish health, queue, outbox, storage, realtime, email, security, and auction monitoring.

Exit condition: staff can run the platform without database access or ad-hoc scripts.

### Phase 9 — Release hardening

- [ ] Expand unit, policy, service, worker, integration, browser, concurrency, and load coverage around actual product invariants.
- [ ] Run dependency, static, secret, migration, container, SAST, DAST, penetration, accessibility, and privacy reviews.
- [ ] Verify backups, point-in-time recovery, restore drills, queue/outbox recovery, failover, and rollback procedures.
- [ ] Establish data classification, retention, deletion, consent, moderation, incident response, and breach procedures.
- [ ] Complete Nepal-specific legal review for property advertising, agent conduct, KYC/privacy, auctions, deposits, and electronic records.
- [ ] Establish performance budgets, CDN/media strategy, database indexes from real queries, cache policy, and observability targets.
- [ ] Complete staged rollout, feature flags, operational training, and production readiness review.

## Recommended discussion and delivery order

Each topic should be specified, implemented as a vertical slice, tested, and accepted before moving to the next large area:

1. Actor model, custom staff RBAC, agent lifecycle, and owner governance.
2. Desktop sidebar, mobile bottom dock, and shared application shell.
3. Property-post structure, creation, feed card, and detail experience.
4. Social interactions and discovery.
5. Continue flow, agent selection, replacement, and assignment-backed ratings.
6. Verification/KYC policy.
7. Auction administration, participant access, and realtime experience.
8. Messaging/notifications, then calls only if launch-critical.
9. Full operations, performance, and release hardening.

For each topic, capture before coding: actors, entry conditions, states and transitions, permissions, validation, failure/empty/loading states, notifications, audit events, retention/privacy, API contracts, schema changes, migration strategy, tests, and acceptance criteria.

## Deferred decisions

These require the user's detailed section-specific explanation and should not be guessed:

- Exact staff permission catalogue and which staff role may create or grant another role.
- Owner count, emergency recovery, transfer, and whether any action requires dual approval.
- Whether agents are employees, contractors, agency members, or a mixture.
- Agent assignment acceptance, fees/commission, geographic coverage, workload limits, disputes, and replacement authority.
- Exact social interactions, public comment rules, follow behavior, moderation rules, and ranking algorithm.
- Required property types, Nepal land units, documents, approval rules, and whether every post is moderated before publication.
- KYC levels, provider/manual review, document retention, expiry, and jurisdictional requirements.
- Auction creation authority, legal terms, deposits/payments, reserve price, participant privacy, VIP-pass capabilities, settlement, and dispute rules.
- Whether voice/video calls are required and whether recording is forbidden or allowed with consent.
