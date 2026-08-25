import { z } from "zod"
import {
  supportThreadListSchema,
  supportThreadSchema,
} from "@real-estate/contracts"
import { apiRequest } from "@/shared/http/api"

const visitorThreadSchema = z.object({
  thread: supportThreadSchema.nullable(),
  ttlMinutes: z.number().int().positive().nullable(),
})

const sentSchema = z.object({ id: z.uuid(), createdAt: z.string() })

export const getSupportThread = (signal?: AbortSignal) =>
  apiRequest("/support/thread", {
    method: "GET",
    schema: visitorThreadSchema,
    signal,
  })

export const sendSupportMessage = (body: string, attachmentId?: string) =>
  apiRequest("/support/messages", {
    method: "POST",
    body: { body, ...(attachmentId ? { attachmentId } : {}) },
    schema: sentSchema,
  })

export const getSupportThreads = (
  query: {
    status?: string
    mine?: boolean
    search?: string
    cursor?: string
    limit?: number
  },
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.mine) params.set("mine", "true")
  if (query.search) params.set("search", query.search)
  if (query.cursor) params.set("cursor", query.cursor)
  params.set("limit", String(query.limit ?? 25))
  return apiRequest(`/admin/support/threads?${params.toString()}`, {
    method: "GET",
    schema: supportThreadListSchema,
    signal,
  })
}

export const getSupportThreadDetail = (id: string, signal?: AbortSignal) =>
  apiRequest(`/admin/support/threads/${id}`, {
    method: "GET",
    schema: supportThreadSchema,
    signal,
  })

export const replyToSupportThread = (id: string, body: string) =>
  apiRequest(`/admin/support/threads/${id}/messages`, {
    method: "POST",
    body: { body },
    schema: sentSchema,
  })

export const closeSupportThread = (id: string) =>
  apiRequest(`/admin/support/threads/${id}/close`, {
    method: "POST",
    schema: z.object({ id: z.uuid(), status: z.string() }),
  })

const viewersSchema = z.object({
  viewers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      holder: z.boolean(),
    }),
  ),
})

/** Announces this staff member is reading the thread and returns who else is. */
export const joinSupportThread = (id: string, signal?: AbortSignal) =>
  apiRequest(`/admin/support/threads/${id}/presence`, {
    method: "POST",
    schema: viewersSchema,
    signal,
  })

export const leaveSupportThread = (id: string) =>
  apiRequest(`/admin/support/threads/${id}/presence`, {
    method: "DELETE",
    schema: z.object({ left: z.boolean() }),
  })
