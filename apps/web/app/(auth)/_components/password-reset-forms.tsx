"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@real-estate/auth/client";
import { toast } from "sonner";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: `${globalThis.location.origin}/reset-password`,
    });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message || "Unable to request a password reset");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          If the account exists, a password-reset link has been sent. The response is
          intentionally identical for unknown email addresses.
        </p>
        <Link href="/sign-in" className="text-sm font-semibold text-emerald-700">
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600"
        />
      </label>
      <button
        disabled={pending}
        className="brand-button h-11 w-full rounded-xl font-semibold"
      >
        {pending ? "Sendingâ€¦" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token");
  const invalidToken = search.get("error") === "INVALID_TOKEN";
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("confirmation"));
    if (password !== confirmation) {
      toast.error("Passwords do not match");
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message || "The reset link is invalid or expired");
      return;
    }
    toast.success("Password updated. Sign in with your new password.");
    router.replace("/sign-in");
  }

  if (!token || invalidToken) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          This password-reset link is invalid or expired.
        </p>
        <Link href="/forgot-password" className="text-sm font-semibold text-emerald-700">
          Request another link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        New password
        <input
          name="password"
          type="password"
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          required
          className="mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600"
        />
      </label>
      <label className="block text-sm font-medium">
        Confirm new password
        <input
          name="confirmation"
          type="password"
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          required
          className="mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-emerald-600"
        />
      </label>
      <button
        disabled={pending}
        className="brand-button h-11 w-full rounded-xl font-semibold"
      >
        {pending ? "Updatingâ€¦" : "Reset password"}
      </button>
    </form>
  );
}
