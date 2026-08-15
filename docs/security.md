# Security model

## Identity and sessions

- Better Auth uses database sessions and first-party secure cookies behind one public origin.
- Email verification precedes property publication; phone and identity eligibility precede live bidding.
- Moderators and administrators must enroll TOTP/2FA; recovery codes are shown only during secure enrollment/regeneration.
- Passkeys are configured for the production RP/domain and require user verification.
- Session inventory and revocation are exposed to users; password/security changes revoke other sessions.
- Google/GitHub secrets and provider tokens belong in a secret manager. Stored provider refresh/access tokens require envelope encryption where retention is necessary.

## Authorization

Global roles and agency roles are separate. Auction participation is per-auction eligibility, not a global role. Every controller and gateway operation applies resource policy checks; hiding a UI action is never authorization.

High-risk admin actions require a reason, fresh authentication where appropriate, TOTP, idempotency and an audit record. Impersonation is explicit, short-lived and fully audited.

## Media

- Every browser upload first enters a private quarantine bucket/prefix, including media that may later become public.
- Only worker-reencoded public image variants are published to the public bucket/CDN; original images and documents remain private.
- Browser uploads use short-lived, purpose-bound signed URLs and randomized keys.
- Completion and processing enforce declared size, a hard streamed-byte cap and object metadata checks.
- Worker validates magic bytes, scans with ClamAV, calculates SHA-256 and rejects unsupported content.
- Image dimensions are bounded; variants are re-encoded without EXIF/GPS metadata.
- PDFs are accepted only for private document purposes.
- Private downloads use short-lived authorization-checked signed URLs.

## Account deletion

Deletion is a grace-period workflow, not a direct cascade. New activity is restricted, active auctions/settlements block finalization, public listings are withdrawn, authentication/profile data is removed or anonymized, personal profile/KYC/licence media is purged through retryable jobs, and legally required bid/payment/audit records retain pseudonymous references according to policy.

## Operational controls

Use TLS, a secret manager, encrypted backups, PostgreSQL least-privilege roles, private database networking, PgBouncer where required, Redis ACL/TLS in managed environments, object-storage versioning, immutable audit export, dependency scanning, CSP tuning, restore drills and incident runbooks.


See `security-assessment.md` for resolved findings, residual risks and release disposition.
