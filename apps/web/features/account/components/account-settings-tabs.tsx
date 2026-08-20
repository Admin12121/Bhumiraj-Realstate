"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@real-estate/auth/client";

import {
  getAccount,
  getSessions,
  revokeSession,
} from "@/features/account/api/account-api";
import { queryKeys } from "@/shared/query/query-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { ProfileForm } from "@/app/(account)/account/_components";
import { TableEmptyRow } from "@/components/ui/table-empty-row";

type PasskeyRecord = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
  deviceType?: string | null;
};

/** Trim a user agent to the browser people recognise. */
function summariseUserAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  for (const name of ["Edg", "Chrome", "Firefox", "Safari", "curl", "Bun"]) {
    if (agent.includes(name)) return name === "Edg" ? "Microsoft Edge" : name;
  }
  return agent.slice(0, 40);
}

/**
 * A staff member's own account, laid out the way the reference console does it:
 * one table per subject with a Status and an Action column, rather than a stack
 * of cards. A visit is usually to check whether 2FA is on, not to fill a form,
 * so state reads at a glance and controls open only when chosen.
 */
export function AccountSettingsTabs({
  initialTab = "profile",
}: {
  /** Lets a link land on a specific tab, e.g. /account/settings?tab=security. */
  initialTab?: string;
} = {}) {
  const client = useQueryClient();
  const [tab, setTab] = useState(initialTab);
  const [dialog, setDialog] = useState<"password" | "twoFactor" | null>(null);
  const [password, setPassword] = useState("");
  const [renaming, setRenaming] = useState<PasskeyRecord | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [passkeyPage, setPasskeyPage] = useState(1);

  const account = useQuery({
    queryKey: queryKeys.account.overview,
    queryFn: getAccount,
  });
  const sessions = useQuery({
    queryKey: queryKeys.account.sessions,
    queryFn: getSessions,
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

  const refreshAccount = () => {
    void client.invalidateQueries({ queryKey: queryKeys.account.overview });
    void client.invalidateQueries({ queryKey: queryKeys.account.passkeys });
  };

  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success("Device signed out.");
      void client.invalidateQueries({ queryKey: queryKeys.account.sessions });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPasskey = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey({
        name: `${navigator.platform || "Device"} passkey`,
        authenticatorAttachment: "platform",
      });
      if (result?.error) {
        throw new Error(result.error.message || "Passkey registration failed");
      }
    },
    onSuccess: () => {
      toast.success("Passkey added.");
      refreshAccount();
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
      toast.success("Passkey removed.");
      refreshAccount();
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
      toast.success("Passkey renamed.");
      setRenaming(null);
      refreshAccount();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const twoFactor = useMutation({
    mutationFn: async ({ enable }: { enable: boolean }) => {
      const result = enable
        ? await authClient.twoFactor.enable({ password })
        : await authClient.twoFactor.disable({ password });
      if (result.error) {
        throw new Error(result.error.message || "Could not update 2FA");
      }
    },
    onSuccess: () => {
      toast.success("Two-factor setting updated.");
      setDialog(null);
      setPassword("");
      refreshAccount();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePassword = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form);
      const result = await authClient.changePassword({
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
        revokeOtherSessions: true,
      });
      if (result.error) {
        throw new Error(result.error.message || "Unable to update password");
      }
    },
    onSuccess: () => {
      toast.success("Password updated. Other devices were signed out.");
      setDialog(null);
      void client.invalidateQueries({ queryKey: queryKeys.account.sessions });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signOutEverywhere = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeSessions();
      if (result.error) throw new Error(result.error.message ?? "Failed");
      await authClient.signOut();
    },
    onSuccess: () => location.assign("/sign-in"),
    onError: (error: Error) => toast.error(error.message),
  });

  const hasPassword = account.data?.providers.includes("credential") ?? false;
  const twoFactorOn = account.data?.twoFactorEnabled ?? false;
  const passkeyList = passkeys.data ?? [];
  const sessionList = sessions.data ?? [];
  const providers = account.data?.providers ?? [];

  const PAGE_SIZE = 10;
  const page = <T,>(rows: T[], current: number) =>
    rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pageCount = (total: number) =>
    Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleSessions = page(sessionList, sessionPage);
  const visiblePasskeys = page(passkeyList, passkeyPage);

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        className="grid gap-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="security">Security</TabsTab>
          <TabsTab value="sessions">Sessions ({sessionList.length})</TabsTab>
          <TabsTab value="passkeys">Passkeys ({passkeyList.length})</TabsTab>
        </TabsList>

        <TabsPanel value="profile">
          <ProfileForm />
        </TabsPanel>

        <TabsPanel value="security">
          <div className="grid gap-4">
            <Frame>
              <Table variant="card">
                <TableHeader>
                  <TableRow>
                    <TableHead>Security</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="w-44 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="font-medium">Password</div>
                      <div className="text-xs text-muted-foreground">
                        Protect your account with a password
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hasPassword ? "success" : "secondary"}>
                        {hasPassword ? "Set" : "Not set"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDialog("password")}
                      >
                        Change
                      </Button>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>
                      <div className="font-medium">Passkey</div>
                      <div className="text-xs text-muted-foreground">
                        Sign in with fingerprint, face, or device PIN
                      </div>
                    </TableCell>
                    <TableCell>
                      {passkeyList.length > 0 ? (
                        <Badge variant="success">
                          {passkeyList.length} registered
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={addPasskey.isPending}
                        onClick={() => addPasskey.mutate()}
                      >
                        Add passkey
                      </Button>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>
                      <div className="font-medium">
                        Two-factor authentication
                      </div>
                      <div className="text-xs text-muted-foreground">
                        TOTP authenticator app
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={twoFactorOn ? "success" : "secondary"}>
                        {twoFactorOn ? "Enabled" : "Not enabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDialog("twoFactor")}
                      >
                        {twoFactorOn ? "Disable 2FA" : "Set up 2FA"}
                      </Button>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>
                      <div className="font-medium">Sign out of all devices</div>
                      <div className="text-xs text-muted-foreground">
                        End all active sessions including this one
                      </div>
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={signOutEverywhere.isPending}
                        onClick={() => signOutEverywhere.mutate()}
                      >
                        Sign out all
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Frame>

            <Frame>
              <Table variant="card">
                <TableHeader>
                  <TableRow>
                    <TableHead>Connected accounts</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="w-44 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { id: "google", label: "Google" },
                    { id: "credential", label: "Password" },
                  ].map((provider) => {
                    const connected = providers.includes(provider.id);
                    return (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">
                          {provider.label}
                        </TableCell>
                        <TableCell>
                          <Badge variant={connected ? "success" : "secondary"}>
                            {connected ? "Connected" : "Not connected"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {provider.id === "google" && !connected ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                authClient.linkSocial({
                                  provider: "google",
                                  callbackURL: "/admin/account",
                                })
                              }
                            >
                              Connect
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Frame>
          </div>
        </TabsPanel>

        <TabsPanel value="sessions" className="grid gap-4">
          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Logged devices — {sessionList.length}</TableHead>
                  <TableHead className="w-40">IP address</TableHead>
                  <TableHead className="w-44">Last used</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="max-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {summariseUserAgent(session.userAgent)}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {session.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.ipAddress ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(session.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {session.current ? (
                          <Badge variant="success">Current</Badge>
                        ) : null}
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={session.current || revoke.isPending}
                        onClick={() => revoke.mutate(session.id)}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableEmptyRow
                  colSpan={5}
                  when={sessionList.length === 0}
                  icon={MonitorSmartphone}
                  title={
                    sessions.isPending ? "Loading devices…" : "No active sessions"
                  }
                  description="Devices you sign in from appear here."
                />
              </TableBody>
            </Table>
          </Frame>
          <TablePagination
            currentPage={sessionPage}
            totalPages={pageCount(sessionList.length)}
            totalItems={sessionList.length}
            pageSize={PAGE_SIZE}
            onPageChange={setSessionPage}
          />
        </TabsPanel>

        <TabsPanel value="passkeys" className="grid gap-4">
          <Frame>
            <Table variant="card">
              <TableHeader>
                <TableRow>
                  <TableHead>Passkeys — {passkeyList.length}</TableHead>
                  <TableHead className="w-40">Type</TableHead>
                  <TableHead className="w-44">Added</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePasskeys.map((passkey) => (
                  <TableRow key={passkey.id}>
                    <TableCell className="font-medium">
                      {passkey.name || "Passkey"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {passkey.deviceType ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {passkey.createdAt
                        ? new Date(passkey.createdAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRenameDraft(passkey.name || "Passkey");
                            setRenaming(passkey);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive-outline"
                          onClick={() => removePasskey.mutate(passkey.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableEmptyRow
                  colSpan={4}
                  when={passkeyList.length === 0}
                  icon={KeyRound}
                  title={
                    passkeys.isPending ? "Loading passkeys…" : "No passkeys"
                  }
                  description="Add one to sign in with a fingerprint, face, or device PIN."
                />
              </TableBody>
            </Table>
          </Frame>
          <TablePagination
            currentPage={passkeyPage}
            totalPages={pageCount(passkeyList.length)}
            totalItems={passkeyList.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPasskeyPage}
          />
        </TabsPanel>
      </Tabs>

      <Dialog
        open={dialog === "password"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogPopup>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              changePassword.mutate(event.currentTarget);
            }}
            className="contents"
          >
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                Other devices are signed out when the password changes.
              </DialogDescription>
            </DialogHeader>
            <DialogPanel className="space-y-4">
              <Field>
                <FieldLabel>Current password</FieldLabel>
                <Input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field>
                <FieldLabel>New password</FieldLabel>
                <Input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                />
              </Field>
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit" loading={changePassword.isPending}>
                Update password
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={dialog === "twoFactor"}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setPassword("");
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {twoFactorOn ? "Disable two-factor" : "Enable two-factor"}
            </DialogTitle>
            <DialogDescription>
              Confirm your password to change how this account is protected.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Current password</FieldLabel>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant={twoFactorOn ? "destructive" : "default"}
              loading={twoFactor.isPending}
              disabled={!password}
              onClick={() => twoFactor.mutate({ enable: !twoFactorOn })}
            >
              {twoFactorOn ? "Disable" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Rename passkey</DialogTitle>
            <DialogDescription>
              The name is only shown to you, to tell your devices apart.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Passkey name</FieldLabel>
              <Input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                maxLength={60}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={!renameDraft.trim()}
              loading={renamePasskey.isPending}
              onClick={() =>
                renaming &&
                renamePasskey.mutate({
                  id: renaming.id,
                  name: renameDraft.trim(),
                })
              }
            >
              Save name
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
