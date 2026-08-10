const CURRENCY_LABELS: Record<string, string> = {
  NPR: "Rs.",
};

/**
 * Formats a decimal minor-unit value without converting through JavaScript
 * number, so database BIGINT values remain precise in the browser.
 */
export function formatMinorAmount(
  amountMinor: string | bigint,
  currency = "NPR",
  locale = "en-IN",
): string {
  const amount = typeof amountMinor === "bigint" ? amountMinor : BigInt(amountMinor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const label = CURRENCY_LABELS[currency] ?? currency;
  const decimal = fraction === "00" ? "" : `.${fraction}`;
  return `${negative ? "-" : ""}${label} ${whole.toLocaleString(locale)}${decimal}`;
}

export function formatOptionalMinorAmount(
  amountMinor: string | null | undefined,
  currency = "NPR",
  fallback = "Contact agent",
): string {
  return amountMinor ? formatMinorAmount(amountMinor, currency) : fallback;
}
