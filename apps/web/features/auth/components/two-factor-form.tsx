"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@real-estate/auth/client";
import { toast } from "sonner";
import { safeReturnPath } from "../../../shared/security/safe-return-path";

export function TwoFactorForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code"));
    setPending(true);
    const result = backup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: true })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: true });
    setPending(false);
    if (result.error) return toast.error(result.error.message || "Invalid verification code");
    router.push(safeReturnPath(search.get("callbackURL")));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        {backup ? "Backup code" : "Authenticator code"}
        <input name="code" autoFocus inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" required minLength={6} maxLength={32} className="mt-2 h-12 w-full rounded-xl border px-4 text-center font-mono text-xl tracking-[.35em] outline-none focus:border-emerald-600" />
      </label>
      <button disabled={pending} className="brand-button h-11 w-full rounded-xl font-semibold">{pending ? "Verifying…" : "Verify and continue"}</button>
      <button type="button" onClick={() => setBackup((value) => !value)} className="w-full text-xs font-semibold text-emerald-700">{backup ? "Use authenticator code" : "Use a backup code"}</button>
    </form>
  );
}
