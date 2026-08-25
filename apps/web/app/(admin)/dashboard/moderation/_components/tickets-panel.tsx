"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  ArrowLeft,
  Check,
  FileCheck2,
  Search,
  Send,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import {
  getModerationQueue,
  getTicket,
  getTicketStaff,
  replyToTicket,
  transferTicket,
} from "@/features/admin/api/admin-api";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  NestedSidebar,
  NestedSidebarItem,
} from "@/components/ui/nested-sidebar";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
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
import { TablePagination } from "@/components/ui/table-pagination";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@real-estate/auth/client";
import {
  PanelEmptyRow,
  PanelRecords,
  PanelSection,
  PanelToolbar,
  PanelToolbarSpacer,
} from "../../_components/panel-layout";
import { useHasStaffPermission } from "../../_components/admin-shell";
import { errorMessage } from "@/shared/http/error-message";

type Kind = "LISTING_REPORT" | "USER_REPORT";

const STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
const statusItems = STATUSES.map((value) => ({
  value,
  label: value.replace(/_/g, " "),
}));

function statusVariant(status: string) {
  if (status === "RESOLVED") return "success" as const;
  if (status === "OPEN") return "warning" as const;
  return "secondary" as const;
}


export function TicketsPanel() {
  const client = useQueryClient();
  const session = useSession();
  const canManage = useHasStaffPermission("admin.moderation.manage");

  const [kind, setKind] = useState<Kind>("LISTING_REPORT");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("OPEN");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [mine, setMine] = useState(false);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  const queue = useQuery({
    queryKey: ["admin", "moderation", kind, status, page, debouncedSearch, mine],
    queryFn: () =>
      getModerationQueue(page, kind, status, debouncedSearch, mine),
    placeholderData: (previous) => previous,
  });

  const ticket = useQuery({
    queryKey: ["admin", "ticket", kind, openTicket],
    queryFn: ({ signal }) => getTicket(kind, openTicket!, signal),
    enabled: openTicket !== null,
    refetchInterval: 15_000,
  });

  const staff = useQuery({
    queryKey: ["admin", "ticket-staff", staffSearch.trim()],
    queryFn: ({ signal }) => getTicketStaff(staffSearch.trim(), signal),
  });

  const reply = useMutation({
    mutationFn: (body: string) => replyToTicket(kind, openTicket!, body),
    onSuccess: async () => {
      setDraft("");
      await client.invalidateQueries({ queryKey: ["admin", "ticket"] });
      await client.invalidateQueries({ queryKey: ["admin", "moderation"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const transfer = useMutation({
    mutationFn: (assigneeId: string) =>
      transferTicket(kind, openTicket!, assigneeId),
    onSuccess: async () => {
      toast.success("Ticket transferred.");
      setStaffSearch("");
      await client.invalidateQueries({ queryKey: ["admin", "ticket"] });
      await client.invalidateQueries({ queryKey: ["admin", "moderation"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const items = queue.data?.items ?? [];
  const detail = ticket.data ?? null;
  const mineAlready = detail?.assignedToId === session.data?.user.id;
  const canReply =
    canManage && (!detail?.assignedToId || mineAlready);

  if (openTicket && detail) {
    return (
      <NestedSidebar
        fullHeight
        width="20rem"
        actions={
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <InputGroup className="h-7 min-w-0 flex-1">
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets"
                aria-label="Search tickets"
                type="search"
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <Button
              aria-label="Back to all tickets"
              onClick={() => setOpenTicket(null)}
              size="icon-sm"
              variant="ghost"
            >
              <ArrowLeft />
            </Button>
          </div>
        }
        items={(open) =>
          items.map((item) => (
            <NestedSidebarItem
              icon={<UserRound />}
              isActive={openTicket === item.id}
              key={item.id}
              label={item.subjectLabel}
              onClick={() => setOpenTicket(item.id)}
              open={open}
            >
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-medium">
                  {item.subjectLabel}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {item.reason}
                </span>
              </span>
            </NestedSidebarItem>
          ))
        }
        header={(toggle) => (
          <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            {toggle}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">
                {detail.subjectLabel}
              </p>
              <p className="truncate text-muted-foreground text-xs">
                {detail.reason}
                {detail.assignedToName ? ` · ${detail.assignedToName}` : ""}
              </p>
            </div>
            {canManage && mineAlready ? (
              <>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        aria-label="Transfer ticket"
                        size="icon-sm"
                        variant="outline"
                      />
                    }
                  >
                    <ArrowLeftRight />
                  </PopoverTrigger>
                  <PopoverPopup align="end" className="w-72 p-2">
                    <InputGroup className="mb-2">
                      <InputGroupInput
                        value={staffSearch}
                        onChange={(event) => setStaffSearch(event.target.value)}
                        placeholder="Search staff"
                        aria-label="Search staff"
                        type="search"
                      />
                      <InputGroupAddon>
                        <Search />
                      </InputGroupAddon>
                    </InputGroup>
                    <ul className="m-0 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
                      {(staff.data?.items ?? [])
                        .filter((member) => member.id !== detail.assignedToId)
                        .map((member) => (
                          <li
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                            key={member.id}
                          >
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {member.name}
                            </span>
                            <Button
                              aria-label={`Transfer to ${member.name}`}
                              disabled={transfer.isPending}
                              onClick={() => transfer.mutate(member.id)}
                              size="icon-sm"
                              variant="ghost"
                            >
                              <UserRoundPlus />
                            </Button>
                          </li>
                        ))}
                      {(staff.data?.items ?? []).length === 0 ? (
                        <li className="px-2 py-3 text-center text-muted-foreground text-sm">
                          No staff match that search.
                        </li>
                      ) : null}
                    </ul>
                  </PopoverPopup>
                </Popover>
                <Button
                  aria-label="Close ticket"
                  onClick={() => setOpenTicket(null)}
                  size="icon-sm"
                  variant="outline"
                >
                  <Check />
                </Button>
              </>
            ) : null}
          </div>
        )}
      >
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport className="px-5 py-4">
              <MessageScrollerContent>
                <MessageScrollerItem>
                  <MessageGroup>
                    <Message align="start">
                      <MessageContent>
                        <Bubble variant="muted">
                          <BubbleContent>
                            {detail.reason}
                            {detail.details ? `\n\n${detail.details}` : ""}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                    <MessageFooter>
                      {detail.reporterName} · raised the ticket
                    </MessageFooter>
                  </MessageGroup>
                </MessageScrollerItem>

                {detail.messages.map((message) => (
                  <MessageScrollerItem key={message.id}>
                    <MessageGroup>
                      <Message align={message.fromStaff ? "end" : "start"}>
                        <MessageContent>
                          <Bubble
                            align={message.fromStaff ? "end" : "start"}
                            variant={message.fromStaff ? "default" : "muted"}
                          >
                            <BubbleContent>{message.body}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                      <MessageFooter
                        className={message.fromStaff ? "justify-end" : undefined}
                      >
                        {message.authorName}
                      </MessageFooter>
                    </MessageGroup>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>

          {canReply ? (
            <form
              className="flex shrink-0 items-end gap-2 border-t p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const body = draft.trim();
                if (body) reply.mutate(body);
              }}
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={1}
                maxLength={4000}
                placeholder={
                  detail.assignedToId
                    ? "Write a reply…"
                    : "Replying assigns this ticket to you…"
                }
                aria-label="Reply"
                className="max-h-28 min-h-10 flex-1 resize-none"
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send reply"
                loading={reply.isPending}
                disabled={!draft.trim()}
              >
                <Send />
              </Button>
            </form>
          ) : (
            <div className="shrink-0 border-t p-3">
              <Marker role="status">
                <MarkerContent>
                  <span className="font-medium">{detail.assignedToName}</span> is
                  handling this ticket. You can read it, but not reply.
                </MarkerContent>
              </Marker>
            </div>
          )}
        </MessageScrollerProvider>
      </NestedSidebar>
    );
  }

  return (
    <PanelSection className="p-2">
      <PanelToolbar className="lg:grid-cols-[minmax(18rem,26rem)_minmax(1rem,1fr)_12rem_12rem_auto]">
        <InputGroup>
          <InputGroupInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search tickets"
            aria-label="Search tickets"
            type="search"
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <PanelToolbarSpacer />
        <Select
          items={[
            { value: "LISTING_REPORT", label: "Listing reports" },
            { value: "USER_REPORT", label: "User reports" },
          ]}
          value={kind}
          onValueChange={(value) => {
            setKind(value as Kind);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by ticket kind">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="LISTING_REPORT">Listing reports</SelectItem>
            <SelectItem value="USER_REPORT">User reports</SelectItem>
          </SelectPopup>
        </Select>
        <Select
          items={statusItems}
          value={status}
          onValueChange={(value) => {
            setStatus(value as (typeof STATUSES)[number]);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="Filter by ticket status">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={
                  mine ? "Showing your tickets" : "Show only your tickets"
                }
                aria-pressed={mine}
                onClick={() => {
                  setMine((current) => !current);
                  setPage(1);
                }}
                size="icon"
                variant={mine ? "default" : "outline"}
              />
            }
          >
            <UserRound />
          </TooltipTrigger>
          <TooltipContent>{mine ? "Yours" : "All tickets"}</TooltipContent>
        </Tooltip>
      </PanelToolbar>

      <PanelRecords>
        <Frame>
          <Table variant="card">
            <TableHeader>
              <TableRow>
                <TableHead>Tickets - {queue.data?.total ?? 0}</TableHead>
                <TableHead className="w-56">Reported by</TableHead>
                <TableHead className="w-56">Reason</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-28">Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  className="cursor-pointer"
                  key={item.id}
                  onClick={() => setOpenTicket(item.id)}
                >
                  <TableCell className="font-medium">
                    {item.subjectLabel}
                  </TableCell>
                  <TableCell>
                    <div className="truncate">{item.reporter.name}</div>
                    <div className="truncate text-muted-foreground text-xs">
                      {item.reporter.email}
                    </div>
                  </TableCell>
                  <TableCell className="truncate">{item.reason}</TableCell>
                  <TableCell>
                    <Badge size="sm" variant={statusVariant(item.status)}>
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              <PanelEmptyRow
                colSpan={5}
                when={items.length === 0}
                icon={FileCheck2}
                title={queue.isPending ? "Loading tickets…" : "No tickets here"}
                description={
                  queue.isError
                    ? "Tickets could not be loaded."
                    : "Reports raised by signed-in users appear here."
                }
              />
            </TableBody>
          </Table>
        </Frame>
      </PanelRecords>

      <TablePagination
        currentPage={queue.data?.page ?? page}
        totalPages={queue.data?.pageCount ?? 1}
        totalItems={queue.data?.total}
        pageSize={queue.data?.pageSize}
        onPageChange={setPage}
      />
    </PanelSection>
  );
}
