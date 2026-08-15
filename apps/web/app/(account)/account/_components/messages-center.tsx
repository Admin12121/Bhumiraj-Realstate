"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";
import {
  ArrowDown,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  Send,
} from "lucide-react";
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

const realtimeMessageSchema = z.object({
  type: z.literal("message.created"),
  conversationId: z.string(),
  messageId: z.string().optional(),
});
type ConversationsData = ReturnType<typeof useConversations>["data"];

export function MessagesCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedFromUrl = searchParams.get("conversation") ?? undefined;
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

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
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    },
    onError: (error: Error) => toast.error(error.message),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
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

  useEffect(() => {
    if (selectedId) {
      requestAnimationFrame(() => endRef.current?.scrollIntoView());
    }
  }, [messageItems.length, selectedId]);

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
    <section className="surface grid min-h-[660px] overflow-hidden rounded-2xl lg:grid-cols-[320px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r">
        <div className="border-b p-4">
          <h2 className="font-semibold">Conversations</h2>
          <p className="mt-1 text-xs text-slate-500">Buyers, sellers and agents.</p>
        </div>
        <div className="max-h-[590px] overflow-y-auto">
          {conversationItems.map((conversation) => {
            const person = conversation.participants[0];
            const active = conversation.id === selectedId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`flex w-full items-center gap-3 border-b p-4 text-left ${active ? "bg-emerald-50" : "hover:bg-slate-50"}`}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                  {person?.name[0]?.toUpperCase() ?? "M"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">
                      {conversation.participants.map((item) => item.name).join(", ") || "Conversation"}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="grid min-w-5 place-items-center rounded-full bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {conversation.lastMessage?.body || "No messages"}
                  </p>
                </div>
              </button>
            );
          })}
          {conversations.hasNextPage && (
            <button
              type="button"
              onClick={() => conversations.fetchNextPage()}
              disabled={conversations.isFetchingNextPage}
              className="flex w-full items-center justify-center gap-2 p-4 text-xs font-semibold text-emerald-700"
            >
              <ArrowDown className="size-4" />
              {conversations.isFetchingNextPage ? "Loadingâ€¦" : "Load more conversations"}
            </button>
          )}
          {!conversations.isLoading && !conversationItems.length && (
            <p className="p-10 text-center text-sm text-slate-500">
              Your conversations will appear here.
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-h-[560px] flex-col">
        {selectedId ? (
          <>
            <header className="flex items-center gap-3 border-b p-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                {selectedConversation?.participants[0]?.name[0]?.toUpperCase() ?? "M"}
              </span>
              <div>
                <p className="font-semibold">
                  {selectedConversation?.participants.map((item) => item.name).join(", ") || "Conversation"}
                </p>
                <p className="text-xs text-slate-500">Messages are delivered in real time.</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
              {messages.hasNextPage && (
                <button
                  type="button"
                  onClick={() => messages.fetchNextPage()}
                  disabled={messages.isFetchingNextPage}
                  className="mx-auto mb-5 flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  <ArrowDown className="size-3.5 rotate-180" />
                  {messages.isFetchingNextPage ? "Loadingâ€¦" : "Load earlier messages"}
                </button>
              )}
              <div className="space-y-3">
                {messageItems.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.mine ? "rounded-br-md bg-emerald-800 text-white" : "rounded-bl-md bg-white text-slate-700"}`}
                    >
                      <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.mine ? "text-emerald-100" : "text-slate-400"}`}>
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {message.mine && <CheckCheck className="size-3" />}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.isLoading && (
                  <div className="grid place-items-center py-12 text-sm text-slate-500">
                    <LoaderCircle className="mb-2 size-5 animate-spin" /> Loading messagesâ€¦
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <form onSubmit={submit} className="flex gap-3 border-t bg-white p-4">
              <label className="sr-only" htmlFor="message-body">Message</label>
              <textarea
                id="message-body"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={5000}
                rows={1}
                placeholder="Write a messageâ€¦"
                className="min-h-11 flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={!draft.trim() || send.isPending}
                className="brand-button grid size-11 shrink-0 place-items-center rounded-xl disabled:opacity-50"
                aria-label="Send message"
              >
                {send.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-10 text-center">
            <div>
              <MessageCircle className="mx-auto size-10 text-emerald-700" />
              <h2 className="mt-4 font-semibold">Select a conversation</h2>
              <p className="mt-2 text-sm text-slate-500">Start from a public profile or property listing.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
