import { listingFeedResponseSchema, type ListingFeedQuery, createListingSchema } from "@real-estate/contracts";
import { z } from "zod";
import { apiRequest } from "@/shared/http/api";

export async function getListingFeed(
  filters: Partial<ListingFeedQuery> & { cursor?: string | undefined },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  return apiRequest(`/listings?${params}`, { method: "GET", schema: listingFeedResponseSchema, signal });
}

const createdListingSchema = z.object({ id: z.string(), slug: z.string(), status: z.string() });
export function createListing(input: z.infer<typeof createListingSchema>) {
  return apiRequest("/listings", { method: "POST", body: input, schema: createdListingSchema });
}
export function submitListing(id: string) {
  return apiRequest(`/listings/${id}/submit`, { method: "POST", schema: z.unknown() });
}
