"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSearch, MessagesSquare, ShieldAlert } from "lucide-react";

import {
  decideModerationReport,
  getAdminAgents,
  getAdminAudit,
  getAdminMessages,
  getModerationQueue,
  getPlatformSettings,
  updatePlatformSettings,
} from "@/features/admin/api/admin-api";
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
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Frame } from "@/components/ui/frame";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useHasStaffPermission } from "./admin-shell";
import { useStepUp } from "./step-up-dialog";

type ModerationKind = "LISTING_REPORT" | "USER_REPORT";
type ModerationDecision = "IN_REVIEW" | "RESOLVED" | "DISMISSED";

const moderationKinds: { value: ModerationKind; label: string }[] = [
  { value: "LISTING_REPORT", label: "Listing reports" },
  { value: "USER_REPORT", label: "User reports" },
];

/** Shared frame so every operations panel paginates and reads the same way. */
function PanelSurface({
  children,
  toolbar,
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  page: number;
  pageCount: number;
  total?: number | undefined;
  pageSize?: number | undefined;
  onPage: (page: number) => void;
}) {
  return (
    <div className="grid gap-4">
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {toolbar}
        </div>
      ) : null}
      <Frame>
        <div className="rounded-xl border bg-background bg-clip-padding">
          {children}
        </div>
      </Frame>
      <TablePagination
        currentPage={page}
        totalPages={pageCount}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={onPage}
      />
    </div>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileSearch;
  title: string;
  description: string;
}) {
  return (
    <Empty className="py-14">
      <EmptyMedia variant="icon">
        <Icon />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </Empty>
  );
}

export function ModerationPanel() {
  const client = useQueryClient();
  const canManage = useHasStaffPermission("admin.moderation.manage");
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<ModerationKind>("LISTING_REPORT");
  // The note is mandatory, so a decision is staged until the moderator gives it.
  const [pending, setPending] = useState<{
    id: string;
    status: ModerationDecision;
    label: string;
  } | null>(null);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["admin", "moderation", kind, page],
    queryFn: () => getModerationQueue(page, kind),
    placeholderData: (previous) => previous,
  });

  const decision = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: ModerationDecision;
      reason: string;
    }) => decideModerationReport(kind, id, status, reason),
    onSuccess: async () => {
      toast.success("Report updated.");
      setPending(null);
      setNote("");
      await client.invalidateQueries({ queryKey: ["admin", "moderation"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = query.data?.items ?? [];

  return (
    <>
      <PanelSurface
        page={query.data?.page ?? page}
        pageCount={query.data?.pageCount ?? 1}
        total={query.data?.total}
        pageSize={query.data?.pageSize}
        onPage={setPage}
        toolbar={
          <>
            <Select
              items={moderationKinds}
              value={kind}
              onValueChange={(value) => {
                setKind(value as ModerationKind);
                setPage(1);
              }}
            >
              <SelectTrigger
                aria-label="Filter by report kind"
                className="w-[200px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {moderationKinds.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <span className="text-xs text-muted-foreground">
              {query.data?.total ?? 0} reports
            </span>
          </>
        }
      >
        {items.length === 0 ? (
          <PanelEmpty
            icon={ShieldAlert}
            title={query.isLoading ? "Loading reports…" : "Nothing to moderate"}
            description={
              query.isError
                ? "Reports could not be loaded."
                : "Reports raised by buyers and agents land here."
            }
          />
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <article
                key={item.id}
                className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge size="sm" variant="warning">
                      {item.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="mt-2 font-semibold">{item.subjectLabel}</h2>
                  <p className="mt-1 text-sm">{item.reason}</p>
                  {item.details ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.details}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reported by {item.reporter.name} · {item.reporter.email}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPending({
                          id: item.id,
                          status: "IN_REVIEW",
                          label: "Mark under review",
                        })
                      }
                    >
                      Review
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        setPending({
                          id: item.id,
                          status: "RESOLVED",
                          label: "Resolve report",
                        })
                      }
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPending({
                          id: item.id,
                          status: "DISMISSED",
                          label: "Dismiss report",
                        })
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PanelSurface>

      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setNote("");
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{pending?.label ?? "Update report"}</DialogTitle>
            <DialogDescription>
              The note is written to the audit log alongside your decision.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Field>
              <FieldLabel>Moderator note</FieldLabel>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Explain the decision"
                minLength={3}
                required
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              loading={decision.isPending}
              disabled={note.trim().length < 3}
              onClick={() => {
                if (!pending) return;
                decision.mutate({
                  id: pending.id,
                  status: pending.status,
                  reason: note.trim(),
                });
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}

export function AgentsPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "agents", page],
    queryFn: () => getAdminAgents(page),
    placeholderData: (previous) => previous,
  });
  const items = query.data?.items ?? [];

  return (
    <PanelSurface
      page={query.data?.page ?? page}
      pageCount={query.data?.pageCount ?? 1}
      total={query.data?.total}
      pageSize={query.data?.pageSize}
      onPage={setPage}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agents - {query.data?.total ?? 0}</TableHead>
              <TableHead className="w-40">Licence</TableHead>
              <TableHead className="w-36">Verification</TableHead>
              <TableHead className="w-32">Rating</TableHead>
              <TableHead className="w-28">Listings</TableHead>
              <TableHead className="w-32">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <p className="font-semibold">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                </TableCell>
                <TableCell>
                  {agent.licenseNumber ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    size="sm"
                    variant={agent.verifiedAt ? "success" : "warning"}
                  >
                    {agent.verifiedAt ? "Verified" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {agent.averageRating.toFixed(1)} ({agent.reviewCount})
                </TableCell>
                <TableCell className="tabular-nums">
                  {agent.activeListings}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(agent.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <PanelEmpty
                    icon={FileSearch}
                    title={query.isLoading ? "Loading agents…" : "No agents yet"}
                    description={
                      query.isError
                        ? "Agents could not be loaded."
                        : "Verified agents appear here once they are approved."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </PanelSurface>
  );
}

export function AuditPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => getAdminAudit(page),
    placeholderData: (previous) => previous,
  });
  const items = query.data?.items ?? [];

  return (
    <PanelSurface
      page={query.data?.page ?? page}
      pageCount={query.data?.pageCount ?? 1}
      total={query.data?.total}
      pageSize={query.data?.pageSize}
      onPage={setPage}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">When</TableHead>
              <TableHead className="w-64">Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="w-64">Actor</TableHead>
              <TableHead className="w-40 text-right">Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-medium">{entry.action}</TableCell>
                <TableCell className="max-w-0">
                  <p className="truncate">{entry.entityType}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.entityId}
                  </p>
                </TableCell>
                <TableCell className="max-w-0">
                  <p className="truncate">
                    {entry.actor ? entry.actor.name : "System"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.reason ?? entry.actor?.email ?? "—"}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <code className="text-[10px] text-muted-foreground">
                    {entry.requestId ?? "—"}
                  </code>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <PanelEmpty
                    icon={FileSearch}
                    title={
                      query.isLoading
                        ? "Loading activity…"
                        : "No recorded activity"
                    }
                    description={
                      query.isError
                        ? "The audit log could not be loaded."
                        : "Every staff action is written here as it happens."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </PanelSurface>
  );
}

export function AdminMessagesPanel() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "messages", page],
    queryFn: () => getAdminMessages(page),
    placeholderData: (previous) => previous,
  });
  const items = query.data?.items ?? [];

  return (
    <PanelSurface
      page={query.data?.page ?? page}
      pageCount={query.data?.pageCount ?? 1}
      total={query.data?.total}
      pageSize={query.data?.pageSize}
      onPage={setPage}
    >
      {items.length === 0 ? (
        <PanelEmpty
          icon={MessagesSquare}
          title={
            query.isLoading ? "Loading conversations…" : "No conversations yet"
          }
          description={
            query.isError
              ? "Conversations could not be loaded."
              : "Conversations between buyers, sellers and agents appear here."
          }
        />
      ) : (
        <div className="divide-y">
          {items.map((conversation) => (
            <article key={conversation.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {conversation.participants
                    .map((participant) => participant.name)
                    .join(", ") || "Support conversation"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {conversation.messageCount} messages
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {conversation.lastMessage?.body ?? "No messages yet."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Updated {new Date(conversation.updatedAt).toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      )}
    </PanelSurface>
  );
}

type PlatformSettings = Awaited<ReturnType<typeof getPlatformSettings>>;

export function SettingsPanel() {
  const client = useQueryClient();
  const { guard } = useStepUp();
  const canManage = useHasStaffPermission("admin.settings.manage");
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: getPlatformSettings,
  });
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const values = draft ?? query.data;

  const mutation = useMutation({
    mutationFn: (next: PlatformSettings) =>
      guard(() => updatePlatformSettings(next)),
    onSuccess: async () => {
      toast.success("Platform settings saved.");
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!values) {
    return (
      <section className="rounded-xl border bg-background p-8 text-sm text-muted-foreground">
        {query.isError ? "Settings could not be loaded." : "Loading settings…"}
      </section>
    );
  }

  const set = <Key extends keyof PlatformSettings>(
    key: Key,
    value: PlatformSettings[Key],
  ) => setDraft({ ...values, [key]: value });

  return (
    <section className="max-w-3xl rounded-xl border bg-background p-6">
      <div className="space-y-5">
        <SettingSwitch
          label="Require property moderation"
          description="New listings stay unpublished until a moderator approves them."
          value={Boolean(values.propertyModerationRequired)}
          disabled={!canManage}
          onChange={(value) => set("propertyModerationRequired", value)}
        />
        <SettingSwitch
          label="Require verified identity for auctions"
          description="Bidders must complete identity verification before registering."
          value={Boolean(values.auctionIdentityRequired)}
          disabled={!canManage}
          onChange={(value) => set("auctionIdentityRequired", value)}
        />
        <SettingNumber
          label="Default anti-sniping window (seconds)"
          value={Number(values.defaultAuctionExtensionWindowSeconds)}
          disabled={!canManage}
          onChange={(value) =>
            set("defaultAuctionExtensionWindowSeconds", value)
          }
        />
        <SettingNumber
          label="Default extension duration (seconds)"
          value={Number(values.defaultAuctionExtensionDurationSeconds)}
          disabled={!canManage}
          onChange={(value) =>
            set("defaultAuctionExtensionDurationSeconds", value)
          }
        />
        <SettingNumber
          label="Maximum property images"
          value={Number(values.maximumPropertyImages)}
          disabled={!canManage}
          onChange={(value) => set("maximumPropertyImages", value)}
        />
      </div>

      {canManage ? (
        <Button
          className="mt-7"
          loading={mutation.isPending}
          disabled={draft === null}
          onClick={() => mutation.mutate(values)}
        >
          Save settings
        </Button>
      ) : null}
    </section>
  );
}

function SettingSwitch({
  label,
  description,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field className="flex-row items-center justify-between rounded-xl border p-4">
      <div className="min-w-0">
        <FieldLabel className="font-medium">{label}</FieldLabel>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={value} disabled={disabled} onCheckedChange={onChange} />
    </Field>
  );
}

function SettingNumber({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    // FieldLabel needs a Field root above it; the number field is the control.
    <Field className="grid gap-2 sm:grid-cols-[1fr_190px] sm:items-center sm:gap-4">
      <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
      <NumberField
        value={value}
        min={0}
        disabled={disabled}
        onValueChange={(next) => onChange(next ?? 0)}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </Field>
  );
}
