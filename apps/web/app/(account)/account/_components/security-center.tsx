"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fingerprint,
  KeyRound,
  Pencil,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { authClient } from "@real-estate/auth/client";
import { toast } from "sonner";
import { cancelDeletion, getAccount, requestDeletion } from "@/features/account/api/account-api";
import { queryKeys } from "@/shared/query/query-keys";

type PasskeyRecord = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
  deviceType?: string | null;
};

function authError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message || fallback);
  }
  return fallback;
}

export function SecurityCenter() {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState<{
    uri: string;
    backupCodes: string[];
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");

  const account = useQuery({
    queryKey: queryKeys.account.overview,
    queryFn: getAccount,
  });

  const passkeys = useQuery({
    queryKey: queryKeys.account.passkeys,
    queryFn: async () => {
      const result = await authClient.passkey.listUserPasskeys();
      if (result.error) {
        throw new Error(result.error.message || "Could not load passkeys");
      }
      return (result.data ?? []) as PasskeyRecord[];
    },
  });

  const deletion = useMutation({
    mutationFn: requestDeletion,
    onSuccess: (result) => {
      toast.success(
        `Deletion scheduled for ${new Date(result.scheduledFor).toLocaleDateString()}.`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.overview });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancellation = useMutation({
    mutationFn: cancelDeletion,
    onSuccess: () => {
      toast.success("Account deletion cancelled.");
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.overview });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removePasskey = useMutation({
    mutationFn: async (id: string) => {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) {
        throw new Error(result.error.message || "Could not remove passkey");
      }
    },
    onSuccess: () => {
      toast.success("Passkey removed");
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.passkeys });
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.overview });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renamePasskey = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const result = await authClient.passkey.updatePasskey({ id, name });
      if (result.error) {
        throw new Error(result.error.message || "Could not rename passkey");
      }
    },
    onSuccess: () => {
      toast.success("Passkey renamed");
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.passkeys });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function enableTwoFactor() {
    const result = await authClient.twoFactor.enable({
      ...(password ? { password } : {}),
    });
    if (result.error) {
      toast.error(result.error.message || "Could not enable 2FA");
      return;
    }

    const data = result.data as {
      method?: string;
      totpURI?: string;
      backupCodes?: string[];
    };
    if (!data.totpURI) {
      toast.error("The authenticator setup URI was not returned.");
      return;
    }
    setTotp({ uri: data.totpURI, backupCodes: data.backupCodes ?? [] });
    setBackupCodes(data.backupCodes ?? []);
  }

  async function verifyTwoFactor() {
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) {
      toast.error(result.error.message || "Invalid code");
      return;
    }
    toast.success("Two-factor authentication enabled");
    setTotp(null);
    setPassword("");
    setCode("");
    void queryClient.invalidateQueries({ queryKey: queryKeys.account.overview });
  }

  async function disableTwoFactor() {
    const confirmed = globalThis.confirm(
      "Disable authenticator protection for this account?",
    );
    if (!confirmed) return;

    const result = await authClient.twoFactor.disable({
      ...(password ? { password } : {}),
    });
    if (result.error) {
      toast.error(result.error.message || "Could not disable 2FA");
      return;
    }
    setPassword("");
    setBackupCodes([]);
    toast.success("Two-factor authentication disabled");
    void queryClient.invalidateQueries({ queryKey: queryKeys.account.overview });
  }

  async function regenerateBackupCodes() {
    const result = await authClient.twoFactor.generateBackupCodes({
      ...(password ? { password } : {}),
    });
    if (result.error) {
      toast.error(result.error.message || "Could not generate backup codes");
      return;
    }
    const codes = (result.data as { backupCodes?: string[] })?.backupCodes ?? [];
    setBackupCodes(codes);
    toast.success("New backup codes generated. Previous codes are invalid.");
  }

  async function addPasskey() {
    try {
      const result = await authClient.passkey.addPasskey({
        name: `${navigator.platform || "Device"} passkey`,
        authenticatorAttachment: "platform",
      });
      if (result.error) {
        toast.error(result.error.message || "Passkey registration failed");
        return;
      }
      toast.success("Passkey added");
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.passkeys });
      void queryClient.invalidateQueries({ queryKey: queryKeys.account.overview });
    } catch (error) {
      toast.error(authError(error, "Passkey registration failed"));
    }
  }

  function beginDeletion() {
    const confirmed = globalThis.confirm(
      "Your listings will be withdrawn and the account will enter a reversible grace period. Continue?",
    );
    if (confirmed) deletion.mutate();
  }

  function beginRename(passkey: PasskeyRecord) {
    const name = globalThis.prompt("Passkey name", passkey.name || "Passkey");
    if (!name?.trim()) return;
    renamePasskey.mutate({ id: passkey.id, name: name.trim() });
  }

  function beginPasskeyRemoval(passkey: PasskeyRecord) {
    const confirmed = globalThis.confirm(
      `Remove ${passkey.name || "this passkey"}? You cannot use it to sign in afterward.`,
    );
    if (confirmed) removePasskey.mutate(passkey.id);
  }

  const pendingDeletion = account.data?.lifecycleStatus === "PENDING_DELETION";

  return (
    <div className="space-y-5">
      <section className="surface rounded-2xl p-6">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShieldCheck />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Two-factor authentication</h2>
            <p className="mt-1 text-sm text-slate-500">
              Protect credential sign-in with TOTP and recovery codes.
            </p>

            <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row">
              <input
                aria-label="Current password for security changes"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Confirm current password"
                autoComplete="current-password"
                className="h-10 flex-1 rounded-lg border px-3"
              />
              {account.data?.twoFactorEnabled ? (
                <>
                  <button
                    type="button"
                    onClick={regenerateBackupCodes}
                    className="rounded-lg border px-4 text-sm font-semibold"
                  >
                    New backup codes
                  </button>
                  <button
                    type="button"
                    onClick={disableTwoFactor}
                    className="rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700"
                  >
                    Disable
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={enableTwoFactor}
                  className="rounded-lg border border-emerald-700 px-4 text-sm font-semibold text-emerald-800"
                >
                  Enable
                </button>
              )}
            </div>

            {account.data?.twoFactorEnabled && (
              <p className="mt-3 text-sm font-semibold text-emerald-700">Enabled</p>
            )}

            {totp && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="break-all text-xs">Authenticator URI: {totp.uri}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Authenticator verification code"
                    inputMode="numeric"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="123456"
                    className="h-10 rounded-lg border px-3"
                  />
                  <button
                    type="button"
                    onClick={verifyTwoFactor}
                    className="brand-button rounded-lg px-4 text-sm font-semibold"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}

            {backupCodes.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <KeyRound className="size-4" /> Recovery codes
                </div>
                <p className="mt-1 text-xs text-amber-800">
                  Store these once in a password manager. Each code can be used only once.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-3">
                  {backupCodes.map((backupCode) => (
                    <span key={backupCode}>{backupCode}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <Fingerprint />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Passkeys</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use device biometrics, a PIN, or a hardware security key.
            </p>

            <div className="mt-4 space-y-2">
              {passkeys.isLoading && (
                <p className="text-sm text-slate-500">Loading passkeysâ€¦</p>
              )}
              {passkeys.data?.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  <Fingerprint className="size-5 text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {passkey.name || "Passkey"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {passkey.deviceType || "WebAuthn authenticator"}
                      {passkey.createdAt
                        ? ` Â· Added ${new Date(passkey.createdAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Rename ${passkey.name || "passkey"}`}
                    onClick={() => beginRename(passkey)}
                    className="rounded-lg border p-2 text-slate-600"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${passkey.name || "passkey"}`}
                    onClick={() => beginPasskeyRemoval(passkey)}
                    className="rounded-lg border border-red-200 p-2 text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {!passkeys.isLoading && !passkeys.data?.length && (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                  No passkeys registered.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={addPasskey}
              className="mt-4 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              Add passkey
            </button>
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl border-red-100 p-6">
        <div className="flex gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Trash2 />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold text-red-700">Delete account</h2>
            <p className="mt-1 text-sm text-slate-500">
              Listings are withdrawn immediately. Authentication data is removed after the
              reversible grace period; legally required auction and financial records remain
              pseudonymized.
            </p>
            {pendingDeletion ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                  Deletion pending
                </span>
                <button
                  type="button"
                  onClick={() => cancellation.mutate()}
                  disabled={cancellation.isPending}
                  className="rounded-lg border px-4 py-2 text-sm font-semibold"
                >
                  Keep my account
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={beginDeletion}
                disabled={deletion.isPending}
                className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
              >
                Request account deletion
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
