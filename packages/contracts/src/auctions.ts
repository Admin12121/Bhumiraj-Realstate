import { z } from "zod";
import { cursorPageSchema, idSchema, isoDateSchema, positiveMinorAmountSchema } from "./common";

export const auctionStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "PAUSED",
  "ENDED",
  "AWAITING_SETTLEMENT",
  "SETTLED",
  "CANCELLED",
  "VOIDED",
]);

export const auctionSnapshotSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  status: auctionStatusSchema,
  currency: z.string().length(3),
  startingAmountMinor: positiveMinorAmountSchema,
  currentAmountMinor: positiveMinorAmountSchema,
  minimumIncrementMinor: positiveMinorAmountSchema,
  bidCount: z.number().int().nonnegative(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
  serverTime: isoDateSchema,
  sequence: z.number().int().nonnegative(),
  eventSequence: z.number().int().nonnegative(),
  registered: z.boolean(),
  eligible: z.boolean(),
  winningBidderDisplay: z.string().nullable(),
  listing: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    isVerified: z.boolean(),
    location: z.object({
      locality: z.string(),
      district: z.string(),
    }),
    coverImageUrl: z.string().nullable(),
  }),
});

export const placeBidSchema = z.object({
  amountMinor: positiveMinorAmountSchema,
});

export const bidSchema = z.object({
  id: idSchema,
  auctionId: idSchema,
  amountMinor: positiveMinorAmountSchema,
  sequence: z.number().int().positive(),
  bidderDisplay: z.string(),
  acceptedAt: isoDateSchema,
  mine: z.boolean(),
});

export const placedBidSchema = bidSchema.extend({
  eventSequence: z.number().int().positive(),
  endsAt: isoDateSchema,
  duplicate: z.boolean(),
});

export const auctionRegistrationSchema = z.object({
  id: idSchema,
  auctionId: idSchema,
  status: z.enum(["PENDING", "ELIGIBLE", "REJECTED", "WITHDRAWN"]),
  depositStatus: z.enum([
    "NOT_REQUIRED",
    "PENDING",
    "AUTHORIZED",
    "CAPTURED",
    "RELEASED",
    "REFUNDED",
    "FAILED",
  ]),
});

export const bidHistoryResponseSchema = cursorPageSchema(bidSchema);

export const auctionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auction.bid.accepted"),
    eventId: idSchema,
    auctionId: idSchema,
    sequence: z.number().int(),
    serverTime: isoDateSchema,
    data: bidSchema.extend({ endsAt: isoDateSchema }),
  }),
  z.object({
    type: z.literal("auction.status.changed"),
    eventId: idSchema,
    auctionId: idSchema,
    sequence: z.number().int(),
    serverTime: isoDateSchema,
    data: z.object({ status: auctionStatusSchema }),
  }),
]);

export type AuctionSnapshot = z.infer<typeof auctionSnapshotSchema>;
export type AuctionEvent = z.infer<typeof auctionEventSchema>;
