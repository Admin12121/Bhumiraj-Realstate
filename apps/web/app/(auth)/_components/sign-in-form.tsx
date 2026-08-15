"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Fingerprint, Loader2, Mail } from "lucide-react";
import { signIn, authClient } from "@real-estate/auth/client";
import { toast } from "sonner";
import { safeReturnPath } from "@/shared/security/safe-return-path";

function GithubMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.51 2.87 8.34 6.84 9.69.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.36 1.12 2.93.85.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.97c.85 0 1.7.12 2.5.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.14 10.14 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

export function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackURL = safeReturnPath(search.get("callbackURL"));
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL,
    });
    setPending(false);
    if (result.error) return toast.error(result.error.message || "Unable to sign in");

    const responseData = result.data as { twoFactorRedirect?: boolean } | null;
    if (responseData?.twoFactorRedirect) {
      router.push(`/two-factor?callbackURL=${encodeURIComponent(callbackURL)}`);
      return;
    }
    router.push(callbackURL);
    router.refresh();
  }

  async function passkey() {
    setPending(true);
    const result = await authClient.signIn.passkey({ autoFill: false });
    setPending(false);
    if (result.error) return toast.error(result.error.message || "Passkey sign-in failed");
    router.push(callbackURL);
    router.refresh();
  }

  const social = (provider: "google" | "github") =>
    signIn.social({ provider, callbackURL });

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="email" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100" placeholder="you@example.com" />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input name="password" type="password" required minLength={10} maxLength={128} autoComplete="current-password" className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100" />
        </label>
        <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-semibold text-emerald-700">Forgot password?</Link></div>
        <button disabled={pending} className="brand-button flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}Sign in
        </button>
      </form>
      <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or continue with<span className="h-px flex-1 bg-slate-200" /></div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={pending} onClick={() => void social("google")} className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-white text-sm font-semibold hover:bg-slate-50"><span className="font-bold text-blue-600">G</span>Google</button>
        <button type="button" disabled={pending} onClick={() => void social("github")} className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-white text-sm font-semibold hover:bg-slate-50"><GithubMark />GitHub</button>
      </div>
      <button type="button" disabled={pending} onClick={() => void passkey()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 text-sm font-semibold text-emerald-800"><Fingerprint className="size-5" />Sign in with passkey</button>
      <p className="text-center text-sm text-slate-500">New to Bhumiraj? <Link href="/sign-up" className="font-semibold text-emerald-700">Create an account</Link></p>
    </div>
  );
}
