import {
  conversationPageSchema,
  messagePageSchema,
  messageSchema,
  sendMessageSchema,
} from "@real-estate/contracts";
import { z } from "zod";
import { apiRequest } from "@/shared/http/api";

export const getConversations = (
  cursor?: string,
  signal?: AbortSignal,
) =>
  apiRequest(
    `/messages/conversations?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    { method: "GET", schema: conversationPageSchema, signal },
  );

export const getMessages = (
  conversationId: string,
  cursor?: string,
  signal?: AbortSignal,
) =>
  apiRequest(
    `/messages/conversations/${conversationId}?limit=40${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    { method: "GET", schema: messagePageSchema, signal },
  );

export const sendMessage = (
  conversationId: string,
  input: z.infer<typeof sendMessageSchema>,
) =>
  apiRequest(`/messages/conversations/${conversationId}`, {
    method: "POST",
    body: input,
    schema: messageSchema,
  });

export const markConversationRead = (conversationId: string) =>
  apiRequest(`/messages/conversations/${conversationId}/read`, {
    method: "PATCH",
    schema: z.object({ read: z.boolean() }),
  });
