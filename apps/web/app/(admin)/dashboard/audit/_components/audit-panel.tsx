"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import {
  getAdminAudit,
  } from "@/features/admin/api/admin-api";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelEmptyRow, PanelSearch, PanelSurface } from "../../_components/panel-layout";

const CRITICAL_ACTIONS =
  /(DELETED|BANNED|REJECTED|CANCELLED|REVOKED|TRANSFERRED|IMPERSONATION)/;
const NOTICE_ACTIONS =
  /(CHANGED|UPDATED|PAUSED|WITHDRAWN|SUBMITTED|REVIEWED)/;

function severityOf(action: string): {
  label: string;
  variant: "error" | "warning" | "secondary";
} {
  if (CRITICAL_ACTIONS.test(action))
    return { label: "Critical", variant: "error" };
  if (NOTICE_ACTIONS.test(action))
    return { label: "Notice", variant: "warning" };
  return { label: "Info", variant: "secondary" };
}

const AUDIT_ENTITY_TYPES = [
  "ALL",
  "User",
  "Listing",
  "Auction",
  "AgentProfile",
  "StaffRole",
  "PlatformInvitation",
  "PlatformSetting",
] as const;

const AUDIT_ACTIONS = [
  "ALL",
  "USER_BANNED",
  "USER_UNBANNED",
  "ACCOUNT_TYPE_CHANGED",
  "USER_DELETED",
  "LISTING_PUBLISHED",
  "LISTING_REJECTED",
  "AUCTION_CANCELLED",
  "SETTINGS_UPDATED",
  "STAFF_ROLE_CREATED",
  "STAFF_ROLE_UPDATED",
  "STAFF_ROLE_DELETED",
  "STAFF_ROLE_ASSIGNED",
  "STAFF_ROLE_REMOVED",
  "STAFF_STATUS_CHANGED",
  "PLATFORM_INVITATION_CREATED",
  "PLATFORM_INVITATION_ACCEPTED",
  "PLATFORM_INVITATION_REVOKED",
  "AGENT_CREATED",
  "AGENT_STATUS_CHANGED",
  "AGENT_AVAILABILITY_CHANGED",
  "OWNER_TRANSFERRED",
  "ADMIN_IMPERSONATION_STARTED",
] as const;

const actionLabel = (value: string) =>
  value === "ALL" ? "All actions" : value.replace(/_/g, " ").toLowerCase();

export function AuditPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState<(typeof AUDIT_ACTIONS)[number]>("ALL");
  const [entityType, setEntityType] =
    useState<(typeof AUDIT_ENTITY_TYPES)[number]>("ALL");
  const [direction, setDirection] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["admin", "audit", page, debounced, action, entityType, direction],
    queryFn: () =>
      getAdminAudit(
        page,
        debounced,
        action === "ALL" ? "" : action,
        entityType === "ALL" ? "" : entityType,
        direction,
      ),
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
      toolbar={
        <div className="grid w-full gap-3 lg:grid-cols-[minmax(16rem,24rem)_12rem_13rem_10rem]">
          <PanelSearch
            value={search}
            onValueChange={setSearch}
            placeholder="Search entity id, reason or actor email"
            label="Search the audit log"
          />
          <Select
            items={AUDIT_ACTIONS.map((value) => ({
              value,
              label: actionLabel(value),
            }))}
            value={action}
            onValueChange={(value) => {
              setAction(value as (typeof AUDIT_ACTIONS)[number]);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {AUDIT_ACTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {actionLabel(value)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Select
            items={AUDIT_ENTITY_TYPES.map((value) => ({
              value,
              label: value === "ALL" ? "All entities" : value,
            }))}
            value={entityType}
            onValueChange={(value) => {
              setEntityType(value as (typeof AUDIT_ENTITY_TYPES)[number]);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Filter by entity type">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {AUDIT_ENTITY_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "ALL" ? "All entities" : value}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <Select
            items={[
              { value: "desc", label: "Newest first" },
              { value: "asc", label: "Oldest first" },
            ]}
            value={direction}
            onValueChange={(value) => setDirection(value as "desc" | "asc")}
          >
            <SelectTrigger aria-label="Sort order">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectPopup>
          </Select>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">When</TableHead>
              <TableHead className="w-28">Severity</TableHead>
              <TableHead className="w-64">Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="w-64">Actor</TableHead>
              <TableHead className="w-40 text-right">Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => {
              const severity = severityOf(entry.action);
              return (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge size="sm" variant={severity.variant}>
                      {severity.label}
                    </Badge>
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
                      {entry.reason ?? entry.actor?.email ?? "\u2014"}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <code className="text-[10px] text-muted-foreground">
                      {entry.requestId ?? "\u2014"}
                    </code>
                  </TableCell>
                </TableRow>
              );
            })}
            <PanelEmptyRow
              colSpan={6}
              when={items.length === 0}
              icon={FileSearch}
              title={query.isLoading ? "Loading activity" : "Nothing matches"}
              description={
                query.isError
                  ? "The audit log could not be loaded."
                  : "Clear the filters, or sort oldest first to look further back."
              }
            />
          </TableBody>
        </Table>
      </div>
    </PanelSurface>
  );
}
