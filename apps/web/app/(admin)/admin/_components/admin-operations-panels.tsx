"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  decideModerationReport,
  getAdminAgents,
  getAdminAudit,
  getAdminMessages,
  getModerationQueue,
  getPlatformSettings,
  updatePlatformSettings,
} from "@/features/admin/api/admin-api";
import { useHasStaffPermission } from "./admin-shell";

export function ModerationPanel() {
  const client = useQueryClient();
  const canManage = useHasStaffPermission("admin.moderation.manage");
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<"LISTING_REPORT" | "USER_REPORT">("LISTING_REPORT");
  const query = useQuery({
    queryKey: ["admin", "moderation", kind, page],
    queryFn: () => getModerationQueue(page, kind),
    placeholderData: (previous) => previous,
  });
  const decision = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "IN_REVIEW" | "RESOLVED" | "DISMISSED" }) => {
      const reason = window.prompt("Moderator note:")?.trim();
      if (!reason) throw new Error("A moderator note is required.");
      return decideModerationReport(kind, id, status, reason);
    },
    onSuccess: async () => {
      toast.success("Report updated.");
      await client.invalidateQueries({ queryKey: ["admin", "moderation"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return <section className="surface overflow-hidden rounded-2xl"><div className="flex items-center justify-between border-b p-4"><select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setPage(1); }} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="LISTING_REPORT">Listing reports</option><option value="USER_REPORT">User reports</option></select><span className="text-xs text-slate-500">{query.data?.total ?? 0} reports</span></div><div className="divide-y">{query.data?.items.map((item) => <article key={item.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-2"><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{item.status}</span><span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span></div><h2 className="mt-2 font-semibold">{item.subjectLabel}</h2><p className="mt-1 text-sm text-slate-700">{item.reason}</p>{item.details && <p className="mt-2 text-sm text-slate-500">{item.details}</p>}<p className="mt-2 text-xs text-slate-400">Reported by {item.reporter.name} Â· {item.reporter.email}</p></div>{canManage && <div className="flex items-start gap-2"><button onClick={() => decision.mutate({ id: item.id, status: "IN_REVIEW" })} className="rounded-lg border px-3 py-2 text-xs">Review</button><button onClick={() => decision.mutate({ id: item.id, status: "RESOLVED" })} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white">Resolve</button><button onClick={() => decision.mutate({ id: item.id, status: "DISMISSED" })} className="rounded-lg border px-3 py-2 text-xs text-slate-600">Dismiss</button></div>}</article>)}</div><Pager page={page} pageCount={query.data?.pageCount ?? 1} setPage={setPage} /></section>;
}

export function AgentsPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "agents", page], queryFn: () => getAdminAgents(page), placeholderData: (previous) => previous });
  return <section className="surface overflow-hidden rounded-2xl"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500"><tr><th className="px-5 py-3">Agent</th><th className="px-5 py-3">License</th><th className="px-5 py-3">Verification</th><th className="px-5 py-3">Rating</th><th className="px-5 py-3">Listings</th><th className="px-5 py-3">Joined</th></tr></thead><tbody>{query.data?.items.map((agent) => <tr key={agent.id} className="border-t"><td className="px-5 py-4"><p className="font-semibold">{agent.name}</p><p className="text-xs text-slate-500">{agent.email}</p></td><td className="px-5 py-4">{agent.licenseNumber ?? "â€”"}</td><td className="px-5 py-4">{agent.verifiedAt ? <span className="text-emerald-700">Verified</span> : <span className="text-amber-700">Pending</span>}</td><td className="px-5 py-4">{agent.averageRating.toFixed(1)} ({agent.reviewCount})</td><td className="px-5 py-4">{agent.activeListings}</td><td className="px-5 py-4 text-xs text-slate-500">{new Date(agent.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div><Pager page={page} pageCount={query.data?.pageCount ?? 1} setPage={setPage} /></section>;
}

export function AuditPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "audit", page], queryFn: () => getAdminAudit(page), placeholderData: (previous) => previous });
  return <section className="surface overflow-hidden rounded-2xl"><div className="divide-y">{query.data?.items.map((entry) => <article key={entry.id} className="grid gap-2 p-5 sm:grid-cols-[190px_1fr_auto]"><div><p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p><p className="mt-1 font-semibold">{entry.action}</p></div><div><p className="text-sm">{entry.entityType} Â· {entry.entityId}</p><p className="mt-1 text-xs text-slate-500">{entry.actor ? `${entry.actor.name} (${entry.actor.email})` : "System"}{entry.reason ? ` Â· ${entry.reason}` : ""}</p></div><code className="text-[10px] text-slate-400">{entry.requestId ?? "â€”"}</code></article>)}</div><Pager page={page} pageCount={query.data?.pageCount ?? 1} setPage={setPage} /></section>;
}

export function AdminMessagesPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "messages", page], queryFn: () => getAdminMessages(page), placeholderData: (previous) => previous });
  return <section className="surface overflow-hidden rounded-2xl"><div className="divide-y">{query.data?.items.map((conversation) => <article key={conversation.id} className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{conversation.participants.map((participant) => participant.name).join(", ") || "Support conversation"}</h2><span className="text-xs text-slate-500">{conversation.messageCount} messages</span></div><p className="mt-2 text-sm text-slate-600">{conversation.lastMessage?.body ?? "No messages yet."}</p><p className="mt-2 text-xs text-slate-400">Updated {new Date(conversation.updatedAt).toLocaleString()}</p></article>)}{query.data?.items.length === 0 && <p className="p-10 text-center text-sm text-slate-500">No support conversations.</p>}</div><Pager page={page} pageCount={query.data?.pageCount ?? 1} setPage={setPage} /></section>;
}

type PlatformSettings = Awaited<ReturnType<typeof getPlatformSettings>>;

export function SettingsPanel() {
  const client = useQueryClient();
  const canManage = useHasStaffPermission("admin.settings.manage");
  const query = useQuery({ queryKey: ["admin", "settings"], queryFn: getPlatformSettings });
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const values = draft ?? query.data;
  const mutation = useMutation({ mutationFn: updatePlatformSettings, onSuccess: async () => { toast.success("Platform settings saved."); setDraft(null); await client.invalidateQueries({ queryKey: ["admin", "settings"] }); }, onError: (error: Error) => toast.error(error.message) });
  if (!values) return <section className="surface rounded-2xl p-8 text-sm text-slate-500">Loading settingsâ€¦</section>;
  const set = <Key extends keyof PlatformSettings>(
    key: Key,
    value: PlatformSettings[Key],
  ) => setDraft({ ...values, [key]: value });
  return <section className="surface max-w-3xl rounded-2xl p-6"><div className="space-y-5"><Toggle label="Require property moderation" value={Boolean(values.propertyModerationRequired)} onChange={(value) => set("propertyModerationRequired", value)} /><Toggle label="Require verified identity for auctions" value={Boolean(values.auctionIdentityRequired)} onChange={(value) => set("auctionIdentityRequired", value)} /><NumberSetting label="Default anti-sniping window (seconds)" value={Number(values.defaultAuctionExtensionWindowSeconds)} onChange={(value) => set("defaultAuctionExtensionWindowSeconds", value)} /><NumberSetting label="Default extension duration (seconds)" value={Number(values.defaultAuctionExtensionDurationSeconds)} onChange={(value) => set("defaultAuctionExtensionDurationSeconds", value)} /><NumberSetting label="Maximum property images" value={Number(values.maximumPropertyImages)} onChange={(value) => set("maximumPropertyImages", value)} /></div>{canManage && <button onClick={() => mutation.mutate(values)} disabled={mutation.isPending} className="brand-button mt-7 rounded-xl px-5 py-2.5 text-sm font-semibold">{mutation.isPending ? "Savingâ€¦" : "Save settings"}</button>}</section>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between rounded-xl border p-4 text-sm font-medium"><span>{label}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-emerald-700" /></label>; }
function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="grid gap-2 text-sm font-medium sm:grid-cols-[1fr_180px] sm:items-center"><span>{label}</span><input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 rounded-lg border px-3" /></label>; }
function Pager({ page, pageCount, setPage }: { page: number; pageCount: number; setPage: (page: number) => void }) { return <div className="flex justify-between border-t p-4 text-xs"><span>Page {page} of {Math.max(pageCount, 1)}</span><div className="space-x-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>; }
