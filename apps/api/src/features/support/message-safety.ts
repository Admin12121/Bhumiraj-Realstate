/**
 * Lightweight heuristics for visitor messages. This is triage, not moderation:
 * a hit flags the message for staff rather than blocking it, because a genuine
 * enquiry can easily contain a phone number or a link.
 */

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i;

/** Nepali mobile numbers, with or without country code and separators. */
const PHONE_PATTERN = /(?:\+?977[- ]?)?\b9[78]\d[- ]?\d{7}\b/;

const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/;

/** Payment rails a scammer would push a visitor towards off-platform. */
const PAYMENT_PATTERN =
  /\b(esewa|khalti|fonepay|imepay|western union|bank\s*transfer|account\s*number|swift\s*code)\b/i;

const CREDENTIAL_PATTERN =
  /\b(password|otp|one[- ]time\s*code|cvv|pin\s*number|seed\s*phrase|private\s*key)\b/i;

/** Runs of the same character, and walls of emoji, are almost always spam. */
function isFlooded(body: string): boolean {
  if (/(.)\1{15,}/.test(body)) return true;
  const emoji = body.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  if (emoji > 30) return true;
  const letters = body.replace(/\P{L}/gu, "").length;
  return emoji > 10 && emoji > letters;
}

export type SafetyVerdict = {
  /** Null when nothing tripped; otherwise a short reason staff can scan. */
  flaggedReason: string | null;
};

export function inspectMessage(body: string): SafetyVerdict {
  const reasons: string[] = [];

  if (CREDENTIAL_PATTERN.test(body)) reasons.push("credential request");
  if (PAYMENT_PATTERN.test(body)) reasons.push("payment details");
  if (URL_PATTERN.test(body)) reasons.push("link");
  if (PHONE_PATTERN.test(body)) reasons.push("phone number");
  if (EMAIL_PATTERN.test(body)) reasons.push("email address");
  if (isFlooded(body)) reasons.push("repeated characters");

  if (reasons.length === 0) return { flaggedReason: null };
  return { flaggedReason: reasons.join(", ").slice(0, 200) };
}
