import { z } from "zod";
import { adminPageSchema, adminPaginationQuerySchema, idSchema, isoDateSchema, queryBooleanSchema } from "./common";

export const adminUserSchema = z.object({ id: idSchema, name: z.string(), email: z.string().email(), role: z.string(), banned: z.boolean(), lifecycleStatus: z.enum(["ACTIVE","SUSPENDED","PENDING_DELETION","DELETED"]), emailVerified: z.boolean(), twoFactorEnabled: z.boolean(), listings: z.number().int(), createdAt: isoDateSchema, lastSeenAt: isoDateSchema.nullable() });
export const adminUsersQuerySchema = adminPaginationQuerySchema.extend({ role: z.string().optional(), status: z.enum(["active","banned"]).optional() });
export const adminUsersResponseSchema = adminPageSchema(adminUserSchema);
export const setRoleSchema = z.object({ role: z.enum(["USER","AGENT","MODERATOR","ADMIN","SUPER_ADMIN"]) });
export const banUserSchema = z.object({ reason: z.string().trim().min(3).max(500), expiresAt: z.iso.datetime({ offset: true }).nullable().optional() });

export const adminListingSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
  propertyType: z.string(),
  owner: z.object({ id: idSchema, name: z.string(), email: z.string().email() }),
  priceMinor: z.string().nullable(),
  currency: z.string(),
  createdAt: isoDateSchema,
  publishedAt: isoDateSchema.nullable(),
});
export const adminListingsQuerySchema = adminPaginationQuerySchema.extend({ status: z.string().optional(), type: z.string().optional() });
export const adminListingsResponseSchema = adminPageSchema(adminListingSchema);
export const listingModerationDecisionSchema = z.object({ decision: z.enum(["PUBLISH", "REJECT"]), reason: z.string().trim().max(1000).optional() });

export const adminAuctionSchema = z.object({ id: idSchema, listingId: idSchema, title: z.string(), status: z.string(), currency: z.string().length(3), currentAmountMinor: z.string(), bidCount: z.number().int(), startsAt: isoDateSchema, endsAt: isoDateSchema });
export const adminAuctionsQuerySchema = adminPaginationQuerySchema.extend({ status: z.string().optional() });
export const adminAuctionsResponseSchema = adminPageSchema(adminAuctionSchema);

export const adminAuctionActionSchema = z.object({
  action: z.enum(["PAUSE", "RESUME", "CANCEL"]),
  reason: z.string().trim().min(3).max(1000).optional(),
}).superRefine((value, context) => {
  if (value.action === "CANCEL" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "A cancellation reason is required." });
  }
});

export const moderationItemSchema = z.object({
  id: idSchema,
  kind: z.enum(["LISTING_REPORT", "USER_REPORT"]),
  subjectId: idSchema,
  subjectLabel: z.string(),
  reporter: z.object({ id: idSchema, name: z.string(), email: z.string().email() }),
  reason: z.string(),
  details: z.string().nullable(),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]),
  createdAt: isoDateSchema,
});
export const moderationQueueResponseSchema = adminPageSchema(moderationItemSchema);
export const moderationDecisionSchema = z.object({
  status: z.enum(["IN_REVIEW", "RESOLVED", "DISMISSED"]),
  reason: z.string().trim().min(3).max(1000),
});

export const adminAgentSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string(),
  email: z.string().email(),
  licenseNumber: z.string().nullable(),
  verifiedAt: isoDateSchema.nullable(),
  averageRating: z.number(),
  reviewCount: z.number().int().nonnegative(),
  activeListings: z.number().int().nonnegative(),
  createdAt: isoDateSchema,
});
export const adminAgentsResponseSchema = adminPageSchema(adminAgentSchema);

export const adminAuditSchema = z.object({
  id: idSchema,
  actor: z.object({ id: idSchema, name: z.string(), email: z.string().email() }).nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  reason: z.string().nullable(),
  requestId: z.string().nullable(),
  createdAt: isoDateSchema,
});
export const adminAuditResponseSchema = adminPageSchema(adminAuditSchema);

export const platformSettingsSchema = z.object({
  propertyModerationRequired: z.boolean(),
  auctionIdentityRequired: z.boolean(),
  defaultAuctionExtensionWindowSeconds: z.number().int().min(30).max(900),
  defaultAuctionExtensionDurationSeconds: z.number().int().min(30).max(900),
  maximumPropertyImages: z.number().int().min(1).max(100),
});

export const adminModerationQuerySchema = adminPaginationQuerySchema.extend({
  kind: z.enum(["LISTING_REPORT", "USER_REPORT"]).default("LISTING_REPORT"),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
});
export const adminAgentsQuerySchema = adminPaginationQuerySchema.extend({
  verified: queryBooleanSchema.optional(),
});
export const adminAuditQuerySchema = adminPaginationQuerySchema.extend({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
});

export const adminMessageSchema = z.object({
  id: idSchema,
  type: z.string(),
  participants: z.array(z.object({ id: idSchema, name: z.string(), email: z.string().email() })),
  lastMessage: z.object({ body: z.string(), createdAt: isoDateSchema }).nullable(),
  messageCount: z.number().int().nonnegative(),
  updatedAt: isoDateSchema,
});
export const adminMessagesResponseSchema = adminPageSchema(adminMessageSchema);

export const adminOverviewSchema = z.object({
  counts: z.object({
    activeListings: z.number().int().nonnegative(),
    liveAuctions: z.number().int().nonnegative(),
    verifiedUsers: z.number().int().nonnegative(),
    pendingReviews: z.number().int().nonnegative(),
    totalUsers: z.number().int().nonnegative(),
    verifiedAgents: z.number().int().nonnegative(),
    bidsToday: z.number().int().nonnegative(),
    outboxBacklog: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(
    z.object({
      id: idSchema,
      action: z.string(),
      entityType: z.string(),
      entityId: z.string(),
      actorName: z.string().nullable(),
      createdAt: isoDateSchema,
    }),
  ),
  pendingListings: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      ownerName: z.string(),
      createdAt: isoDateSchema,
    }),
  ),
});
