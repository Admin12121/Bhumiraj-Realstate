const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001F\u007F]/;

export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || CONTROL_OR_BACKSLASH.test(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
