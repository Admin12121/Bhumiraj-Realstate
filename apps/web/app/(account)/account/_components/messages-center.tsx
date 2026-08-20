"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";
import { ArrowUp, CheckCheck, MessageCircle, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@/shared/query/query-keys";
import {
  markConversationRead,
  sendMessage,
} from "@/features/messaging/api/messaging-api";
import {
  useConversations,
  useMessages,
} from "@/features/messaging/queries/use-messaging";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/shared/http/error-message";

const realtimeMessageSchema = z.object({
  type: z.literal("message.created"),
  conversationId: z.string(),
  messageId: z.string().optional(),
});
type ConversationsData = ReturnType<typeof useConversations>["data"];

function participantNames(names: readonly { name: string }[]): string {
  return names.map((item) => item.name).join(", ") || "Conversation";
}

export function MessagesCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedFromUrl = searchParams.get("conversation") ?? undefined;
  const [draft, setDraft] = useState("");

  const conversations = useConversations();
  const conversationItems = useMemo(
    () => conversations.data?.pages.flatMap((page) => page.items) ?? [],
    [conversations.data],
  );
  const selectedId = selectedFromUrl ?? conversationItems[0]?.id;
  const selectedConversation = conversationItems.find(
    (conversation) => conversation.id === selectedId,
  );
  const messages = useMessages(selectedId);
  const messageItems = useMemo(
    () =>
      (messages.data?.pages.flatMap((page) => page.items) ?? [])
        .slice()
        .reverse(),
    [messages.data],
  );

  const send = useMutation({
    mutationFn: (body: string) =>
      sendMessage(selectedId!, { body, mediaAssetIds: [] }),
    onSuccess: (message) => {
      setDraft("");
      queryClient.setQueryData(
        queryKeys.conversations.messages(message.conversationId),
        (current: typeof messages.data) => {
          if (!current?.pages[0]) return current;
          if (
            current.pages.some((page) =>
              page.items.some((item) => item.id === message.id),
            )
          ) {
            return current;
          }
          return {
            ...current,
            pages: [
              {
                ...current.pages[0],
                items: [message, ...current.pages[0].items],
              },
              ...current.pages.slice(1),
            ],
          };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  useEffect(() => {
    if (!selectedId) return;
    void markConversationRead(selectedId).then(() => {
      queryClient.setQueryData(
        queryKeys.conversations.all,
        (current: ConversationsData) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.map((conversation) =>
                    conversation.id === selectedId
                      ? { ...conversation, unreadCount: 0 }
                      : conversation,
                  ),
                })),
              }
            : current,
      );
    });
  }, [queryClient, selectedId]);

  useEffect(() => {
    const socket: Socket = io("/realtime", {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socket.on("notification:event", (raw: unknown) => {
      const parsed = realtimeMessageSchema.safeParse(raw);
      if (!parsed.success) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      if (parsed.data.conversationId === selectedId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.conversations.messages(selectedId),
        });
        void markConversationRead(selectedId);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient, selectedId]);

  function selectConversation(id: string) {
    router.replace(`/account/messages?conversation=${encodeURIComponent(id)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId || send.isPending) return;
    send.mutate(body);
  }

  return (
    <NestedSidebar
      fullHeight
      width="20rem"
      items={(open) => {
        if (conversations.isLoading) {
          return (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-10 w-full rounded-md" />
              ))}
            </div>
          );
        }
        if (conversationItems.length === 0) {
          return open ? (
            <p className="px-3 py-6 text-center text-muted-foreground text-sm">
              Your conversations will appear here.
            </p>
          ) : null;
        }
        return (
          <>
            {conversationItems.map((conversation) => (
              <NestedSidebarItem
                key={conversation.id}
                icon={<UserRound />}
                isActive={conversation.id === selectedId}
                label={participantNames(conversation.participants)}
                onClick={() => selectConversation(conversation.id)}
                open={open}
                {...(conversation.unreadCount > 0
                  ? {
                      trailing: (
                        <Badge className="tabular-nums">
                          {conversation.unreadCount}
                        </Badge>
                      ),
                    }
                  : {})}
              >
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-medium">
                    {participantNames(conversation.participants)}
                  </span>
                  {conversation.lastMessage?.body ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {conversation.lastMessage.body}
                    </span>
                  ) : null}
                </span>
              </NestedSidebarItem>
            ))}
            {conversations.hasNextPage && open ? (
              <Button
                className="mt-1 w-full"
                loading={conversations.isFetchingNextPage}
                onClick={() => conversations.fetchNextPage()}
                size="sm"
                variant="ghost"
              >
                Load more
              </Button>
            ) : null}
          </>
        );
      }}
      header={(toggle) => (
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          {toggle}
          {selectedConversation ? (
            <p className="min-w-0 flex-1 truncate font-medium text-sm">
              {participantNames(selectedConversation.participants)}
            </p>
          ) : null}
        </div>
      )}
    >
      {!selectedId ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircle />
            </EmptyMedia>
            <EmptyTitle>No conversation selected</EmptyTitle>
            <EmptyDescription>
              Start one from a public profile or a property listing.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport className="px-4 py-4 sm:px-6">
              <MessageScrollerContent>
                {messages.hasNextPage ? (
                  <Button
                    className="mx-auto"
                    loading={messages.isFetchingNextPage}
                    onClick={() => messages.fetchNextPage()}
                    size="sm"
                    variant="outline"
                  >
                    <ArrowUp />
                    Load earlier messages
                  </Button>
                ) : null}
                {messages.isLoading
                  ? [0, 1, 2].map((key) => (
                      <Skeleton key={key} className="h-16 w-2/3 rounded-2xl" />
                    ))
                  : messageItems.map((message) => (
                      <MessageScrollerItem
                        key={message.id}
                        scrollAnchor={message === messageItems.at(-1)}
                      >
                        <MessageGroup>
                          <Message align={message.mine ? "end" : "start"}>
                            <MessageContent>
                              <span className="max-w-[82%] rounded-2xl bg-muted px-4 py-3 text-sm leading-6 whitespace-pre-wrap in-data-[align=end]:bg-primary in-data-[align=end]:text-primary-foreground">
                                {message.body}
                              </span>
                            </MessageContent>
                          </Message>
                          <MessageFooter
                            className={message.mine ? "justify-end" : undefined}
                          >
                            {new Date(message.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {message.mine ? (
                              <CheckCheck className="ms-1 size-3" />
                            ) : null}
                          </MessageFooter>
                        </MessageGroup>
                      </MessageScrollerItem>
                    ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>

          <form
            onSubmit={submit}
            className="flex shrink-0 items-end gap-2 border-t bg-background p-3"
          >
            <Textarea
              id="message-body"
              aria-label="Message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends; Shift+Enter is a newline, as everywhere else.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={5000}
              rows={1}
              placeholder="Write a message…"
              className="max-h-32 min-h-10 flex-1 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              loading={send.isPending}
              disabled={!draft.trim()}
            >
              <Send />
            </Button>
          </form>
        </MessageScrollerProvider>
      )}
    </NestedSidebar>
  );
}
