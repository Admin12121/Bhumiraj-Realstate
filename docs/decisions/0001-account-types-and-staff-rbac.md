# ADR 0001: Fixed account types and custom staff RBAC

Date: 2026-08-13  
Status: accepted; the strong-authentication clause is superseded by ADR 0003

## Context

The initial global role field mixed public identity (`USER`, `AGENT`) with platform authority (`MODERATOR`, `ADMIN`, `SUPER_ADMIN`). This made it possible for authentication-provider roles, API checks, and frontend navigation to disagree. The product instead requires four stable actor types while allowing administrators to define staff responsibilities without code changes.

## Decision

- Keep exactly four code-defined account types: `OWNER`, `STAFF`, `AGENT`, and `USER`.
- Apply custom RBAC only to `STAFF`. A staff member may hold multiple custom roles and receives the union of their permissions.
- Register permission keys and descriptions in application code, then synchronize that registry to PostgreSQL. Database rows assign only registered keys; unknown keys are rejected.
- Treat PostgreSQL as the runtime authorization source. Better Auth identifies the signed-in account and account type but does not own custom staff permissions.
- Give `OWNER` every registered permission. This bypass applies only to business permissions, never authentication, strong-authentication checks, audit recording, database integrity, or domain invariants.
- Use role positions for hierarchy. Staff may manage only lower-position roles and may not grant permissions they do not themselves possess.
- ~~Require a passkey or password plus 2FA for protected administration endpoints outside the E2E environment.~~ Superseded by ADR 0003: entry needs only an active staff account, and step-up is required per action for operations that change authority or live auction state.
- Return resolved capabilities from the API and render administration navigation/actions from those capabilities. UI hiding is convenience only; every operation remains guarded by the API.
- Enforce one owner with a partial unique database index. Owner creation or replacement is not part of ordinary user/staff mutation endpoints.

## Migration and compatibility

- Preserve `USER` and `AGENT` as `USER` and `AGENT` account types.
- Convert the oldest existing `SUPER_ADMIN` to the single `OWNER`; convert additional `SUPER_ADMIN` records to `STAFF`.
- Convert `ADMIN` and `MODERATOR` records to `STAFF`, create initial Administrator and Moderator custom roles, and preserve their assignments.
- Run the enum conversion, permission catalogue, role creation, and assignment migration in one transaction so a failure cannot leave a partially converted authorization model.
- Keep the migration additive until assignments are copied, then remove the legacy enum.

## Consequences

New administration domains must register permission keys before using them. Staff role edits and membership changes require audit events and hierarchy checks. Agent onboarding remains a separate lifecycle and must never be implemented as a staff role. Invitation, lifecycle, and owner-transfer governance is defined in ADR 0002.
