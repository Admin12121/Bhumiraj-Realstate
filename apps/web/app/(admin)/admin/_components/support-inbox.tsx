"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Clock,
  MessagesSquare,
  Send,
  UserRound,
} from "lucide-react";
import {
  closeSupportThread,
  getSupportThreadDetail,
  getSupportThreads,
  replyToSupportThread,
} from "@/features/support/api/support-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useHasStaffPermission } from "./admin-shell";
import { errorMessage } from "@/shared/http/error-message";

const STATUSES = ["OPEN", "ASSIGNED", "CLOSED"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  CLOSED: "Closed",
};

function expiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expiring now";
  return `Erases in ${Math.max(1, Math.round(ms / 60000))}m`;
}

/** Staff inbox for general site enquiries. */
export function SupportInbox() {
  const canReply = useHasStaffPermission("admin.support.reply");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("OPEN");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const threads = useQuery({
    queryKey: ["admin", "support", status],
    queryFn: ({ signal }) => getSupportThreads({ status, limit: 25 }, signal),
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  });

  const detail = useQuery({
    queryKey: ["admin", "support", "thread", selected],
    queryFn: ({ signal }) => getSupportThreadDetail(selected!, signal),
    enabled: selected !== null,
    refetchInterval: 10_000,
  });

  const reply = useMutation({
    mutationFn: (body: string) => replyToSupportThread(selected!, body),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const close = useMutation({
    mutationFn: () => closeSupportThread(selected!),
    onSuccess: async () => {
      toast.success("Conversation closed.");
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  const items = threads.data?.items ?? [];
  const active = items.find((item) => item.id === selected) ?? null;
  const messages = detail.data?.messages ?? [];

  return (
    <NestedSidebar
      fullHeight
      width="20rem"
      actions={
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as Status);
            setSelected(null);
          }}
        >
          <SelectTrigger aria-label="Filter conversations" className="h-7 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {STATUS_LABEL[option]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
      items={(open) => {
        if (threads.isPending) {
          return (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-10 w-full rounded-md" />
              ))}
            </div>
          );
        }
        if (items.length === 0) {
          return open ? (
            <p className="px-3 py-6 text-center text-muted-foreground text-sm">
              No {STATUS_LABEL[status].toLowerCase()} conversations.
            </p>
          ) : null;
        }
        return items.map((item) => {
          const expiry = expiryLabel(item.expiresAt);
          return (
            <NestedSidebarItem
              key={item.id}
              icon={<UserRound />}
              isActive={selected === item.id}
              label={item.visitorName}
              onClick={() => setSelected(item.id)}
              open={open}
              trailing={
                <Badge variant="secondary" className="tabular-nums">
                  {item.messageCount}
                </Badge>
              }
            >
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate font-medium">{item.visitorName}</span>
                {expiry ? (
                  <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Clock className="size-3 shrink-0" />
                    {expiry}
                  </span>
                ) : item.lastMessagePreview ? (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {item.lastMessagePreview}
                  </span>
                ) : null}
              </span>
            </NestedSidebarItem>
          );
        });
      }}
      header={(toggle) => (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          {toggle}
          <div className="min-w-0 flex-1">
            {active ? (
              <>
                <p className="truncate font-medium text-sm">
                  {active.visitorName}
                </p>
                {active.assignedToName ? (
                  <p className="truncate text-muted-foreground text-xs">
                    {active.assignedToName}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          {active && canReply && active.status !== "CLOSED" ? (
            <Button
              size="sm"
              variant="outline"
              loading={close.isPending}
              onClick={() => close.mutate()}
            >
              <Check />
              Close
            </Button>
          ) : null}
        </div>
      )}
    >
      {!selected ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquare />
            </EmptyMedia>
            <EmptyTitle>No conversation selected</EmptyTitle>
            <EmptyDescription>
              Pick an enquiry from the list to read and reply to it.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : detail.isPending ? (
        <div className="flex flex-1 flex-col gap-4 p-5">
          <Skeleton className="h-16 w-2/3 rounded-xl" />
          <Skeleton className="h-16 w-1/2 self-end rounded-xl" />
          <Skeleton className="h-16 w-3/5 rounded-xl" />
        </div>
      ) : (
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport className="px-5 py-4">
              <MessageScrollerContent>
                {messages.map((message) => {
                  const staff = message.authorRole === "STAFF";
                  return (
                    <MessageScrollerItem key={message.id}>
                      <MessageGroup>
                        <Message align={staff ? "end" : "start"}>
                          <MessageContent>
                            <span className="max-w-[80%] rounded-2xl bg-muted px-3.5 py-2.5 text-sm leading-6 in-data-[align=end]:bg-primary in-data-[align=end]:text-primary-foreground">
                              {message.body}
                            </span>
                          </MessageContent>
                        </Message>
                        <MessageFooter
                          className={staff ? "justify-end" : undefined}
                        >
                          {staff ? (message.authorName ?? "Staff") : "Visitor"}
                        </MessageFooter>
                      </MessageGroup>
                    </MessageScrollerItem>
                  );
                })}
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
                placeholder="Write a reply…"
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
          ) : null}
        </MessageScrollerProvider>
      )}
    </NestedSidebar>
  );
}
