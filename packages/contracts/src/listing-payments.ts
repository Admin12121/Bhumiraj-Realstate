import { z } from "zod";
import {
  cursorQuerySchema,
  idSchema,
  isoDateSchema,
  minorAmountSchema,
  positiveMinorAmountSchema,
  userIdSchema,
} from "./common";

export const paymentProofStatusSchema = z.enum([
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
]);

export const listingAssignmentStatusSchema = z.enum([
  "OFFERED",
  "ACCEPTED",
  "DECLINED",
  "REVOKED",
  "EXPIRED",
]);

/**
 * A way an owner can settle the listing fee. Configured by administrators, so
 * the shape is validated here rather than hard-coded in the UI.
 */
export const paymentMethodSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  kind: z.enum(["QR", "BANK_TRANSFER", "WALLET"]),
  /** QR image or wallet deep link. */
  imageUrl: z.url().nullable().default(null),
  accountName: z.string().max(120).nullable().default(null),
  accountNumber: z.string().max(60).nullable().default(null),
  bankName: z.string().max(120).nullable().default(null),
  instructions: z.string().max(500).nullable().default(null),
  enabled: z.boolean().default(true),
});

/** Admin-editable listing fee and the methods offered to pay it. */
export const listingFeeSettingsSchema = z.object({
  amountMinor: minorAmountSchema,
  currency: z.string().length(3),
  /** When false, listings skip payment and go straight to review. */
  enabled: z.boolean().default(true),
  methods: z.array(paymentMethodSchema).max(12),
});

export const updateListingFeeSettingsSchema = listingFeeSettingsSchema;

export const submitPaymentProofSchema = z.object({
  listingId: idSchema,
  mediaAssetId: idSchema,
  method: z.string().min(1).max(40),
  reference: z.string().trim().max(120).optional(),
  amountMinor: positiveMinorAmountSchema,
  currency: z.string().length(3),
});

export const reviewPaymentProofSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "REJECT" && !value.rejectionReason) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "A reason is required when rejecting a payment.",
      });
    }
  });

export const paymentProofSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  listingTitle: z.string(),
  listingSlug: z.string(),
  method: z.string(),
  reference: z.string().nullable(),
  amountMinor: minorAmountSchema,
  currency: z.string().length(3),
  status: paymentProofStatusSchema,
  /** Signed, short-lived URL; payment proofs are private media. */
  proofUrl: z.string().nullable(),
  submittedBy: z.object({
    id: idSchema,
    name: z.string(),
    email: z.string(),
  }),
  reviewedBy: z
    .object({ id: idSchema, name: z.string() })
    .nullable(),
  reviewedAt: isoDateSchema.nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: isoDateSchema,
});

export const paymentProofQuerySchema = cursorQuerySchema.extend({
  status: paymentProofStatusSchema.optional(),
});

export const paymentProofListSchema = z.object({
  items: z.array(paymentProofSchema),
  nextCursor: z.string().nullable(),
});

/**
 * Caseload guard rails. Assignment is advisory at the soft limit and refused at
 * the hard one, so an agent is never silently overloaded.
 */
export const AGENT_CASELOAD_WARN_AT = 10;
export const AGENT_CASELOAD_LIMIT = 20;

export const assignListingSchema = z.object({
  agentId: idSchema,
  /** Hours the agent has to respond before the offer expires. */
  expiresInHours: z.coerce.number().int().min(1).max(336).default(72),
});

export const respondToAssignmentSchema = z
  .object({
    decision: z.enum(["ACCEPT", "DECLINE"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.decision === "DECLINE" && !value.note) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "A note is required when declining an assignment.",
      });
    }
  });

export const listingAssignmentSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  listingTitle: z.string(),
  listingSlug: z.string(),
  status: listingAssignmentStatusSchema,
  agent: z.object({
    id: idSchema,
    userId: userIdSchema,
    name: z.string(),
    activeCases: z.number().int().nonnegative(),
    maxActiveCases: z.number().int().positive(),
  }),
  assignedBy: z.object({ id: idSchema, name: z.string() }),
  offeredAt: isoDateSchema,
  respondedAt: isoDateSchema.nullable(),
  expiresAt: isoDateSchema.nullable(),
  responseNote: z.string().nullable(),
});

export const listingAssignmentQuerySchema = cursorQuerySchema.extend({
  status: listingAssignmentStatusSchema.optional(),
});

export const listingAssignmentListSchema = z.object({
  items: z.array(listingAssignmentSchema),
  nextCursor: z.string().nullable(),
});

/** Agent shown in the admin assignment picker, with live capacity. */
export const assignableAgentSchema = z.object({
  id: idSchema,
  userId: userIdSchema,
  name: z.string(),
  image: z.url().nullable(),
  verified: z.boolean(),
  availabilityStatus: z.string(),
  activeCases: z.number().int().nonnegative(),
  maxActiveCases: z.number().int().positive(),
  /** At or past the soft limit: assignment is allowed but flagged in the UI. */
  nearCapacity: z.boolean(),
  /** At the hard limit: assignment is refused. */
  atCapacity: z.boolean(),
});

export const assignableAgentListSchema = z.object({
  items: z.array(assignableAgentSchema),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type ListingFeeSettings = z.infer<typeof listingFeeSettingsSchema>;
export type SubmitPaymentProofInput = z.infer<typeof submitPaymentProofSchema>;
export type PaymentProof = z.infer<typeof paymentProofSchema>;
export type ListingAssignment = z.infer<typeof listingAssignmentSchema>;
export type AssignableAgent = z.infer<typeof assignableAgentSchema>;

/** An agent may only put themselves on or off the queue; AT_CAPACITY is derived. */
export const agentAvailabilitySchema = z
  .object({ availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE"]) })
  .strict();
