"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
import {
  Check,
  Clock,
  Globe,
  MessagesSquare,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import {
  closeSupportThread,
  getSupportThreadDetail,
  getSupportThreads,
  joinSupportThread,
  leaveSupportThread,
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
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useHasStaffPermission } from "../../_components/admin-shell";
import { useSession } from "@real-estate/auth/client";
import { errorMessage } from "@/shared/http/error-message";

/**
 * Global holds the chats nobody has answered yet; General holds the ones this
 * staff member owns. Replying is what moves a chat between them, so there is no
 * separate "claim" step to forget.
 */
type Scope = "GLOBAL" | "GENERAL";

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
  const session = useSession();
  // An owner oversees every assigned chat, not only their own.
  const seesAllAssigned = useHasStaffPermission("admin.support.assign");
  const [scope, setScope] = useState<Scope>("GLOBAL");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const threads = useQuery({
    queryKey: ["admin", "support", scope, debouncedSearch, seesAllAssigned],
    queryFn: ({ signal }) =>
      getSupportThreads(
        {
          status: scope === "GLOBAL" ? "OPEN" : "ASSIGNED",
          // In General an owner sees the whole assigned queue; everyone else
          // sees only what is theirs.
          ...(scope === "GENERAL" && !seesAllAssigned ? { mine: true } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          limit: 25,
        },
        signal,
      ),
    refetchInterval: 15_000,
    placeholderData: (previous) => previous,
  });

  // Presence only matters for an unclaimed chat, where two staff could collide.
  const presence = useQuery({
    queryKey: ["admin", "support", "presence", selected],
    queryFn: ({ signal }) => joinSupportThread(selected!, signal),
    enabled: selected !== null && scope === "GLOBAL",
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!selected) return;
    // Stop counting as present the moment the thread leaves the screen.
    return () => {
      void leaveSupportThread(selected).catch(() => undefined);
    };
  }, [selected]);

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
  const viewers = presence.data?.viewers ?? [];
  const holder = viewers.find((viewer) => viewer.holder) ?? null;
  // Whoever opened an unclaimed chat first gets to answer it; the rest read on.
  const holdsReply =
    scope !== "GLOBAL" || !holder || holder.id === session.data?.user.id;
  const active = items.find((item) => item.id === selected) ?? null;
  const messages = detail.data?.messages ?? [];

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
              placeholder="Search chats"
              aria-label="Search chats"
              type="search"
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={
                    scope === "GLOBAL"
                      ? "Showing unassigned chats. Switch to yours"
                      : "Showing assigned chats. Switch to unassigned"
                  }
                  aria-pressed={scope === "GENERAL"}
                  onClick={() => {
                    setScope((current) =>
                      current === "GLOBAL" ? "GENERAL" : "GLOBAL",
                    );
                    setSelected(null);
                  }}
                  size="icon-sm"
                  variant={scope === "GENERAL" ? "default" : "outline"}
                />
              }
            >
              {scope === "GLOBAL" ? <Globe /> : <UserRound />}
            </TooltipTrigger>
            <TooltipContent>
              {scope === "GLOBAL" ? "Unassigned" : "Assigned"}
            </TooltipContent>
          </Tooltip>
        </div>
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
              {scope === "GLOBAL"
                ? "No unassigned chats."
                : "No chats assigned to you."}
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
          {active && scope === "GLOBAL" ? (
            // Who else is reading this unclaimed chat. Seeing a colleague here
            // is the cue to leave it to them rather than both replying.
            viewers.length > 0 ? (
              <AvatarGroup>
                {viewers.slice(0, 3).map((viewer) => (
                  <Tooltip key={viewer.id}>
                    <TooltipTrigger
                      render={
                        <Avatar className="size-7">
                          {viewer.image ? (
                            <AvatarImage src={viewer.image} alt="" />
                          ) : null}
                          <AvatarFallback>
                            {viewer.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      }
                    />
                    <TooltipContent>
                      {viewer.name}
                      {viewer.holder ? " · replying" : ""}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {viewers.length > 3 ? (
                  <AvatarGroupCount className="size-7">
                    +{viewers.length - 3}
                  </AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            ) : null
          ) : active && canReply ? (
            <Button
              aria-label="Close conversation"
              loading={close.isPending}
              onClick={() => close.mutate()}
              size="icon-sm"
              variant="outline"
            >
              <Check />
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
                            <Bubble
                              align={staff ? "end" : "start"}
                              variant={staff ? "default" : "muted"}
                            >
                              <BubbleContent>{message.body}</BubbleContent>
                            </Bubble>
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

          {canReply && !holdsReply ? (
            <div className="shrink-0 border-t p-3">
              <Marker role="status">
                <MarkerContent>
                  <span className="font-medium">{holder?.name}</span> opened this
                  chat first and is replying. Leave it to them, or pick another.
                </MarkerContent>
              </Marker>
            </div>
          ) : canReply ? (
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
