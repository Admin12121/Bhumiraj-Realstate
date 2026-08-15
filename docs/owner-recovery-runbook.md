# Owner access and recovery runbook

This runbook covers loss or compromise of the single platform-owner account. It does not authorize bypassing authentication or creating a second owner.

## Normal ownership transfer

Use the owner-governance panel while signed in as the current owner with passkey authentication or password plus 2FA. Select an active staff member whose email is verified and whose 2FA is enabled, select fallback roles for the current owner, and enter the exact confirmation phrase.

The API performs the transfer in one serializable transaction, preserves the single-owner database invariant, terminates both accounts' sessions, and records `OWNER_TRANSFERRED`.

## Lost authentication access

1. Confirm the incident through the organization-approved identity-verification channel.
2. Prefer ordinary password/email recovery. Recover authentication factors; do not change the account type.
3. Revoke other sessions and credentials after access is restored, then enroll a new passkey and 2FA recovery material.
4. Review authentication and administration audits for unauthorized activity.

## Suspected compromise

1. Declare a security incident and restrict public/admin traffic if the owner session may still be active.
2. Preserve database, application, proxy, and identity-provider evidence before mutation.
3. Revoke sessions and compromised credentials through the approved identity-administration process.
4. Restore the same owner's authentication access, then use the normal transfer ceremony if ownership must move.

## Emergency owner replacement

There is intentionally no application endpoint or startup flag that replaces an existing owner. A replacement while the owner cannot authenticate requires the still-pending business decisions for approvers, identity evidence, dual control, notification, delay/cooling-off, and rollback. Until those rules are approved, operators must stop and escalate; they must not edit `User.role` directly or disable the single-owner index.

Record every recovery action, approver, reason, timestamp, evidence reference, and validation result in the incident record. Test the finalized process against a restored disposable backup before it is approved for production use.
