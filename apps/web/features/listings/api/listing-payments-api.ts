import { z } from "zod"
import {
  assignableAgentListSchema,
  listingFeeSettingsSchema,
  paymentProofListSchema,
  type ListingFeeSettings,
} from "@real-estate/contracts"
import { apiRequest } from "@/shared/http/api"

export const getListingFee = (signal?: AbortSignal) =>
  apiRequest("/listing-payments/fee", {
    method: "GET",
    schema: listingFeeSettingsSchema,
    signal,
  })

export const submitPaymentProof = (input: {
  listingId: string
  mediaAssetId: string
  method: string
  reference?: string
  amountMinor: string
  currency: string
}) =>
  apiRequest("/listing-payments/proofs", {
    method: "POST",
    body: input,
    schema: z.object({
      id: z.uuid(),
      status: z.string(),
      createdAt: z.string(),
    }),
  })

export const getPaymentProofs = (
  query: { status?: string; cursor?: string; limit?: number },
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams()
  if (query.status) params.set("status", query.status)
  if (query.cursor) params.set("cursor", query.cursor)
  params.set("limit", String(query.limit ?? 20))
  return apiRequest(`/admin/payment-proofs?${params.toString()}`, {
    method: "GET",
    schema: paymentProofListSchema,
    signal,
  })
}

export const reviewPaymentProof = (
  id: string,
  input: { decision: "APPROVE" | "REJECT"; rejectionReason?: string },
) =>
  apiRequest(`/admin/payment-proofs/${id}/review`, {
    method: "POST",
    body: input,
    schema: z.object({ id: z.uuid(), listingStatus: z.string() }),
  })

export const getAssignableAgents = (signal?: AbortSignal) =>
  apiRequest("/admin/assignable-agents", {
    method: "GET",
    schema: assignableAgentListSchema,
    signal,
  })

export const assignListing = (
  listingId: string,
  input: { agentId: string; expiresInHours?: number },
) =>
  apiRequest(`/admin/listings/${listingId}/assign`, {
    method: "POST",
    body: input,
    schema: z.object({
      id: z.uuid(),
      status: z.string(),
      expiresAt: z.string().nullable(),
    }),
  })

export const agentSummarySchema = z.discriminatedUnion("isAgent", [
  z.object({ isAgent: z.literal(false) }),
  z.object({
    isAgent: z.literal(true),
    pendingOffers: z.number(),
    activeCases: z.number(),
    caseloadLimit: z.number(),
    caseloadWarnAt: z.number(),
    atCapacity: z.boolean(),
    availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "AT_CAPACITY"]),
    agentStatus: z.string(),
  }),
])

export type AgentSummary = z.infer<typeof agentSummarySchema>

export const getAgentSummary = (signal?: AbortSignal) =>
  apiRequest("/agent/me", {
    method: "GET",
    schema: agentSummarySchema,
    signal,
  })

export const setAgentAvailability = (
  availabilityStatus: "AVAILABLE" | "UNAVAILABLE",
) =>
  apiRequest("/agent/me", {
    method: "PATCH",
    body: { availabilityStatus },
    schema: agentSummarySchema,
  })

export const agentAssignmentSchema = z.object({
  id: z.uuid(),
  listingId: z.uuid(),
  listingTitle: z.string(),
  listingSlug: z.string(),
  status: z.string(),
  offeredAt: z.string(),
  expiresAt: z.string().nullable(),
})

export const getAgentAssignments = (status: string, signal?: AbortSignal) =>
  apiRequest(`/agent/assignments?status=${encodeURIComponent(status)}`, {
    method: "GET",
    schema: z.object({ items: z.array(agentAssignmentSchema) }),
    signal,
  })

export const respondToAssignment = (
  id: string,
  input: { decision: "ACCEPT" | "DECLINE"; note?: string },
) =>
  apiRequest(`/agent/assignments/${id}/respond`, {
    method: "POST",
    body: input,
    schema: z.object({ id: z.uuid(), listingStatus: z.string() }),
  })

export const updateListingFee = (input: ListingFeeSettings) =>
  apiRequest("/admin/listing-fee", {
    method: "PUT",
    body: input,
    schema: listingFeeSettingsSchema,
  })
