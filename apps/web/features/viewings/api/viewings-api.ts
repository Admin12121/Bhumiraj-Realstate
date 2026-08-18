import {
  availabilityResponseSchema,
  respondToViewingSchema,
  viewingListSchema,
  viewingSchema,
  viewingSlotsSchema,
  type AvailabilityWindow,
} from "@real-estate/contracts"
import { z } from "zod"
import { apiRequest } from "@/shared/http/api"

export const getViewingSlots = (
  slug: string,
  days: number,
  signal?: AbortSignal,
) =>
  apiRequest(
    `/viewings/listings/${encodeURIComponent(slug)}/slots?days=${days}`,
    { method: "GET", schema: viewingSlotsSchema, signal },
  )

export const requestViewing = (
  slug: string,
  input: { startsAt: string; notes?: string },
) =>
  apiRequest(`/viewings/listings/${encodeURIComponent(slug)}`, {
    method: "POST",
    body: input,
    schema: viewingSchema,
  })

export const getAgentViewings = (status: string, signal?: AbortSignal) =>
  apiRequest(`/agent/viewings?status=${encodeURIComponent(status)}`, {
    method: "GET",
    schema: viewingListSchema,
    signal,
  })

export const respondToViewing = (
  id: string,
  input: z.infer<typeof respondToViewingSchema>,
) =>
  apiRequest(`/agent/viewings/${id}/respond`, {
    method: "POST",
    body: input,
    schema: z.object({ id: z.uuid(), status: z.string() }),
  })

export const getAgentAvailability = (signal?: AbortSignal) =>
  apiRequest("/agent/viewings/availability", {
    method: "GET",
    schema: availabilityResponseSchema,
    signal,
  })

export const setAgentAvailability = (windows: AvailabilityWindow[]) =>
  apiRequest("/agent/viewings/availability", {
    method: "PUT",
    body: { windows },
    schema: availabilityResponseSchema,
  })
