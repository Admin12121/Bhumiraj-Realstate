import { z } from "zod";
import {
  cursorPageSchema,
  cursorQuerySchema,
  idSchema,
  isoDateSchema,
  positiveMinorAmountSchema,
  queryBooleanSchema,
  userIdSchema,
} from "./common";
import { listingTypeSchema, propertyTypeSchema } from "./listings";
import { viewingSchema } from "./viewings";

export const savedSearchSchema = z.object({
  id: idSchema,
  name: z.string(),
  filters: z.record(z.string(), z.unknown()),
  alertsEnabled: z.boolean(),
  createdAt: isoDateSchema,
});
export const savedSearchFiltersSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    type: listingTypeSchema.optional(),
    propertyType: propertyTypeSchema.optional(),
    agentId: userIdSchema.optional(),
    district: z.string().trim().max(80).optional(),
    minPriceMinor: positiveMinorAmountSchema.optional(),
    maxPriceMinor: positiveMinorAmountSchema.optional(),
    bedrooms: z.number().int().min(0).max(20).optional(),
    sort: z
      .enum(["newest", "price-asc", "price-desc", "popular"])
      .default("newest"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minPriceMinor !== undefined &&
      value.maxPriceMinor !== undefined &&
      BigInt(value.minPriceMinor) > BigInt(value.maxPriceMinor)
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxPriceMinor"],
        message: "Maximum price must be at least the minimum price.",
      });
    }
  });

export const createSavedSearchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  filters: savedSearchFiltersSchema,
  alertsEnabled: z.boolean().default(false),
});

export const inquirySchema = z.object({
  id: idSchema,
  listingId: idSchema,
  userId: userIdSchema,
  message: z.string(),
  status: z.enum(["OPEN", "CONTACTED", "QUALIFIED", "CLOSED", "SPAM"]),
  createdAt: isoDateSchema,
});
export const createInquirySchema = z.object({ message: z.string().trim().min(10).max(2000) });
export const inquiryPageSchema = cursorPageSchema(inquirySchema);

export const viewingPageSchema = cursorPageSchema(viewingSchema);

export const notificationSchema = z.object({
  id: idSchema,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.unknown().nullable(),
  readAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
});
export const notificationPageSchema = cursorPageSchema(notificationSchema);
export const notificationQuerySchema = cursorQuerySchema.extend({ unreadOnly: queryBooleanSchema.default(false) });

export const conversationSchema = z.object({
  id: idSchema,
  type: z.enum(["LISTING", "DIRECT", "SUPPORT"]),
  listingId: idSchema.nullable(),
  updatedAt: isoDateSchema,
  unreadCount: z.number().int().nonnegative(),
  participants: z.array(z.object({ id: idSchema, name: z.string(), image: z.string().url().nullable() })),
  lastMessage: z.object({ body: z.string(), createdAt: isoDateSchema }).nullable(),
});
export const conversationPageSchema = cursorPageSchema(conversationSchema);
export const messageAttachmentSchema = z.object({
  assetId: idSchema,
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.string().regex(/^\d+$/),
});
export const messageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  senderId: userIdSchema,
  body: z.string(),
  createdAt: isoDateSchema,
  mine: z.boolean(),
  attachments: z.array(messageAttachmentSchema),
});
export const messagePageSchema = cursorPageSchema(messageSchema);
export const sendMessageSchema = z.object({ body: z.string().trim().min(1).max(5000), mediaAssetIds: z.array(idSchema).max(10).default([]) });
export const createConversationSchema = z.object({ listingId: idSchema.optional(), participantId: userIdSchema, message: z.string().trim().min(1).max(5000) });

export const cursorSocialQuerySchema = cursorQuerySchema;
