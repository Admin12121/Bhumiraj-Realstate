import { listingDetailSchema } from "@real-estate/contracts";
import { z } from "zod";
import { apiRequest } from "@/shared/http/api";

export const getListingDetail = (slug: string, signal?: AbortSignal) =>
  apiRequest(`/listings/${encodeURIComponent(slug)}`, {
    method: "GET",
    schema: listingDetailSchema,
    signal,
  });

export const recordListingView = (listingId: string) =>
  apiRequest(`/listings/${listingId}/view`, {
    method: "POST",
    schema: z.object({ counted: z.boolean() }),
  });
