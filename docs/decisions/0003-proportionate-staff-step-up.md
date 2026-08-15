# ADR 0003: Proportionate staff step-up and honest passkey strength

Date: 2026-08-15
Status: accepted  
Supersedes the strong-authentication clause of ADR 0001.

## Context

ADR 0001 required a passkey or password-plus-2FA for every protected
administration endpoint. In practice that gated *entry* to administration on
enrolment: a staff member with a password session could not read a listing
queue, and the failure surfaced as a redirect with no explanation. For a
marketplace of this risk profile the cost in usability was not matched by a
gain in safety, because the sensitive operations are a small subset of the
surface.

Two findings also showed the strong-authentication signal was not honest:

- `authenticatorSelection.userVerification: "required"` shapes credential
  *registration* only. It does not reach assertion.
- The passkey plugin generates authentication options with
  `userVerification: "preferred"` and calls `verifyAuthenticationResponse`
  with `requireUserVerification: false`, at both registration and assertion,
  with no configuration surface to change either.

A passkey session therefore carried no proof of user verification, yet the
guard accepted it as equivalent to password-plus-2FA. A possession-only
assertion was indistinguishable from a biometric one.

## Decision

- Reaching the administration surface requires an active staff or owner
  account and nothing more. Entry is not gated on second-factor enrolment.
- Step-up is demanded per action, through `@StrongAuth()`, and covers the
  operations that change authority or move live auction state: staff and role
  mutations, invitations, account-type and account-standing changes, platform
  settings, and auction pause/resume/cancel. Reads are never gated.
- `@FreshStaffSession()` continues to imply strong authentication and adds a
  30-minute recency requirement. It stays on owner transfer and role
  permission changes.
- A passkey counts as a strong factor only when the assertion reports user
  verification. The user-verified flag is decoded from the authenticator data
  and recorded on the session; an assertion without it is stored as
  `passkey-unverified` and does not satisfy step-up.
- Offer a choice of factors rather than one path. The step-up prompt lists
  passkey, authenticator code and backup code, with a "try another way"
  route between them, and links to enrolment when none is set up.
- Encourage second-factor enrolment with a dismissible prompt inside
  administration. It never blocks work.

## Consequences

Staff can do routine administration with a password session, and meet a
challenge only where the consequence justifies it. Because the passkey plugin
cannot be configured to require user verification, the flag decode is the only
thing standing between a possession-only assertion and a privileged action; it
must not be removed without replacing the guarantee. Any new administration
domain must decide explicitly whether its mutations carry `@StrongAuth()`,
since the default is now open to any active staff session.
