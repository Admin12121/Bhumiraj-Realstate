import { z } from "zod";
import {
  cursorPageSchema,
  idSchema,
  isoDateSchema,
  minorAmountSchema,
  positiveMinorAmountSchema,
  userIdSchema,
} from "./common";
import { paymentMethodSchema } from "./listing-payments";

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

// ── Enrolment ─────────────────────────────────────────────────────────────
// Deposits are settled out of band, so the shapes mirror the listing fee:
// administrators publish the methods, the bidder uploads a receipt, staff
// verify it. `paymentMethodSchema` is shared with the listing fee on purpose.

export const auctionDepositSettingsSchema = z.object({
  amountMinor: minorAmountSchema,
  currency: z.string().length(3),
  /** When false, enrolment needs staff approval but no payment. */
  required: z.boolean().default(true),
  methods: z.array(paymentMethodSchema).max(12),
});
export const updateAuctionDepositSettingsSchema = auctionDepositSettingsSchema;

export const submitEnrolmentSchema = z.object({
  mediaAssetId: idSchema,
  method: z.string().min(1).max(40),
  reference: z.string().trim().max(120).optional(),
});

/** What the enrolment screen needs: the terms, the methods, and where I stand. */
export const enrolmentViewSchema = z.object({
  auctionId: idSchema,
  auctionStatus: auctionStatusSchema,
  listingTitle: z.string(),
  listingSlug: z.string(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
  startingAmountMinor: z.string(),
  currency: z.string().length(3),
  emailVerified: z.boolean(),
  deposit: auctionDepositSettingsSchema,
  registration: auctionRegistrationSchema
    .extend({
      rejectionReason: z.string().nullable(),
      submittedAt: isoDateSchema.nullable(),
    })
    .nullable(),
});

export const enrolmentRowSchema = z.object({
  registrationId: idSchema,
  auctionId: idSchema,
  auctionTitle: z.string(),
  status: auctionRegistrationSchema.shape.status,
  depositStatus: auctionRegistrationSchema.shape.depositStatus,
  amountMinor: z.string(),
  currency: z.string().length(3),
  method: z.string().nullable(),
  reference: z.string().nullable(),
  mediaAssetId: idSchema.nullable(),
  submittedAt: isoDateSchema.nullable(),
  bidder: z.object({
    id: userIdSchema,
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
  }),
});

export const reviewEnrolmentSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "REJECT" && !value.rejectionReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Tell the bidder why the enrolment was rejected.",
      });
    }
  });

export type AuctionDepositSettings = z.infer<typeof auctionDepositSettingsSchema>;
export type EnrolmentView = z.infer<typeof enrolmentViewSchema>;
export type EnrolmentRow = z.infer<typeof enrolmentRowSchema>;
