# ADR 0002: Platform invitations and privileged lifecycles

Date: 2026-08-13  
Status: accepted

## Context

Staff and agents cannot be created through public signup. They need separate reviewed onboarding, lifecycle controls, session invalidation, and audits. Ownership also needs an explicit transfer path without creating a general-purpose privilege-escalation endpoint.

## Decision

- Store only a SHA-256 hash of every invitation token. Tokens expire after seven days, can be revoked, and a newer invitation revokes any older pending invitation for the same email and actor type.
- Require an active customer account with a verified email that exactly matches the normalized invitation recipient. Accepting an invitation terminates all existing sessions.
- A staff invitation carries one or more reviewed staff-role assignments. Staff membership is independently `ACTIVE`, `SUSPENDED`, or `REVOKED`; only active membership may resolve RBAC access.
- An agent invitation creates an `AGENT` account with a separate agent profile in `PENDING` and `UNAVAILABLE`. Approval, suspension, availability/capacity, and terminal retirement remain outside staff RBAC.
- Owner transfer may be initiated only by the current owner after strong authentication. The target must be active staff with a verified email and 2FA. The previous owner must receive explicit fallback staff roles.
- Execute transfer under a PostgreSQL transaction-level advisory lock and serializable transaction. Demote the old owner before promoting the target so the partial unique index is never violated, revoke both sessions, and create an immutable audit event.
- Do not expose emergency owner replacement through HTTP. Account-access recovery uses the authentication recovery path; a genuine ownership incident follows the offline runbook until dual-control requirements are approved.

## Consequences

Agents never inherit staff permissions. Suspension takes effect even if role rows remain assigned. Invitation links are bearer secrets and must not be logged. Owner transfer is deliberate and auditable, while emergency recovery cannot silently become a production backdoor.
