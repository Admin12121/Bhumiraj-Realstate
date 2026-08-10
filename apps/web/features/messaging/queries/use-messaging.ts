"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/query/query-keys";
import { getConversations, getMessages } from "../api/messaging-api";

export function useConversations() {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.all,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getConversations(pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useMessages(conversationId?: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId ?? "none"),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getMessages(conversationId!, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
    staleTime: 5_000,
  });
}
