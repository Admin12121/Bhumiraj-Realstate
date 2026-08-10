"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

function safeInternalPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001F\u007F]/.test(value)) {
    return "/";
  }
  try {
    const parsed = new URL(value, "https://local.invalid");
    return parsed.origin === "https://local.invalid"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}

export const authClient: any = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL
      : window.location.origin,
  basePath: "/api/auth",
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        if (typeof window === "undefined") return;
        const requested = new URL(window.location.href).searchParams.get("callbackURL");
        const callbackURL = safeInternalPath(requested);
        window.location.assign(`/two-factor?callbackURL=${encodeURIComponent(callbackURL)}`);
      },
    }),
    passkeyClient(),
  ],
});

export const { useSession, signIn, signOut, signUp }: any = authClient;
