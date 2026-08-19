const STAFF_ROLES = new Set(["OWNER", "STAFF"]);

/** Roles that work out of the admin console rather than the customer account. */
export function isStaffRole(role: string | null | undefined): boolean {
  return typeof role === "string" && STAFF_ROLES.has(role);
}

/**
 * Where to send someone after they sign in.
 *
 * Staff run the platform from `/admin`, so dropping them on the customer
 * account first costs them a click on every sign-in. A link they actually asked
 * for still wins — only the default "/" is redirected.
 */
export function landingPathFor(
  role: string | null | undefined,
  requested: string,
): string {
  if (requested !== "/") return requested;
  return isStaffRole(role) ? "/admin" : "/";
}
