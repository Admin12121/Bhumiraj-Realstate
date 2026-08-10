import {
  auctionRegistrationSchema,
  auctionSnapshotSchema,
  bidHistoryResponseSchema,
  placedBidSchema,
} from "@real-estate/contracts";
import { apiRequest } from "@/shared/http/api";

export const getAuction = (id: string) =>
  apiRequest(`/auctions/${id}`, {
    method: "GET",
    schema: auctionSnapshotSchema,
  });

export const getBids = (id: string, cursor?: string, signal?: AbortSignal) =>
  apiRequest(
    `/auctions/${id}/bids?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    { method: "GET", schema: bidHistoryResponseSchema, signal },
  );

export const registerAuction = (id: string) =>
  apiRequest(`/auctions/${id}/register`, {
    method: "POST",
    schema: auctionRegistrationSchema,
  });

export const placeBid = (
  id: string,
  amountMinor: string,
  idempotencyKey: string,
) =>
  apiRequest(`/auctions/${id}/bids`, {
    method: "POST",
    body: { amountMinor },
    idempotencyKey,
    schema: placedBidSchema,
  });
