import {
  createConversationSchema,
  followProfileResponseSchema,
  publicAgentsResponseSchema,
  userProfileSchema,
} from "@real-estate/contracts";
import { z } from "zod";
import { apiRequest } from "@/shared/http/api";

export const getPublicProfile = (id: string, signal?: AbortSignal) =>
  apiRequest(`/profiles/${id}`, {
    method: "GET",
    schema: userProfileSchema,
    signal,
  });

export const followProfile = (id: string) =>
  apiRequest(`/profiles/${id}/follow`, {
    method: "POST",
    schema: followProfileResponseSchema,
  });

export const unfollowProfile = (id: string) =>
  apiRequest(`/profiles/${id}/follow`, {
    method: "DELETE",
    schema: followProfileResponseSchema,
  });

const conversationCreatedSchema = z.object({ id: z.string() });
export const startConversation = (
  input: z.infer<typeof createConversationSchema>,
) =>
  apiRequest("/messages/conversations", {
    method: "POST",
    body: input,
    schema: conversationCreatedSchema,
  });

export const getPublicAgents = (
  input: { cursor?: string; limit?: number; search?: string },
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams();
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 20));
  if (input.search) query.set("search", input.search);
  return apiRequest(`/profiles/agents?${query.toString()}`, {
    method: "GET",
    schema: publicAgentsResponseSchema,
    signal,
  });
};
