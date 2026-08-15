/**
 * Authentication-strength helpers. Kept free of Better Auth imports so the
 * API guard and its tests can use them without loading the ESM auth stack.
 */

export type AuthMethod =
  | "credential+2fa"
  | "credential"
  | "passkey"
  | "passkey-unverified"
  | "social"
  | "unknown";

/**
 * Authentication methods that prove more than one factor and therefore satisfy
 * a step-up challenge. A passkey qualifies only when the authenticator actually
 * verified the user; possession of the device on its own does not.
 */
export const STRONG_AUTH_METHODS: readonly AuthMethod[] = [
  "credential+2fa",
  "passkey",
];

export function isStrongAuthMethod(method: string | null): boolean {
  return STRONG_AUTH_METHODS.includes(method as AuthMethod);
}

const AUTHENTICATOR_DATA_FLAGS_OFFSET = 32;
const USER_VERIFIED_FLAG = 0x04;

/**
 * Reads the user-verified bit out of a WebAuthn assertion.
 *
 * The passkey plugin calls `verifyAuthenticationResponse` with
 * `requireUserVerification: false` and offers no option to change it, and
 * `authenticatorSelection` only shapes registration. Without this check a
 * possession-only assertion would be indistinguishable from a biometric one.
 * Returns undefined when the flag cannot be read at all.
 */
export function assertionUserVerified(
  authenticatorData: unknown,
): boolean | undefined {
  if (typeof authenticatorData !== "string" || authenticatorData.length === 0) {
    return undefined;
  }
  try {
    const normalized = authenticatorData.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Buffer.from(normalized, "base64");
    const flags = bytes[AUTHENTICATOR_DATA_FLAGS_OFFSET];
    if (flags === undefined) return undefined;
    return (flags & USER_VERIFIED_FLAG) !== 0;
  } catch {
    return undefined;
  }
}

/**
 * Classifies the route that established a session. Matching stays substring
 * based so a Better Auth path revision does not silently downgrade a session
 * to `unknown`, which staff step-up treats as a failed strong authentication.
 */
export function classifyAuthMethod(
  path: string,
  options: { userVerified?: boolean | undefined } = {},
): AuthMethod {
  const normalized = path.toLowerCase();
  if (
    normalized.includes("two-factor") ||
    normalized.includes("two_factor") ||
    normalized.includes("verify-totp") ||
    normalized.includes("verify-backup-code") ||
    normalized.includes("otp")
  ) {
    return "credential+2fa";
  }
  if (normalized.includes("passkey") || normalized.includes("webauthn")) {
    return options.userVerified === false ? "passkey-unverified" : "passkey";
  }
  if (
    normalized.startsWith("/callback/") ||
    normalized.includes("oauth") ||
    normalized.includes("sign-in/social")
  ) {
    return "social";
  }
  if (normalized.includes("sign-in/email") || normalized.includes("sign-up")) {
    return "credential";
  }
  return "unknown";
}
