import { z } from "zod";
import {
  adminPageSchema,
  adminPaginationQuerySchema,
  idSchema,
  isoDateSchema,
  queryBooleanSchema,
  userIdSchema,
} from "./common";

export const accountTypeSchema = z.enum(["OWNER", "STAFF", "AGENT", "USER"]);
export const adminUserSchema = z.object({
  id: userIdSchema,
  name: z.string(),
  email: z.string().email(),
  accountType: accountTypeSchema,
  banned: z.boolean(),
  lifecycleStatus: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "PENDING_DELETION",
    "DELETED",
  ]),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  listings: z.number().int(),
  createdAt: isoDateSchema,
  lastSeenAt: isoDateSchema.nullable(),
});
export const adminUsersQuerySchema = adminPaginationQuerySchema.extend({
  accountType: accountTypeSchema.optional(),
  status: z.enum(["active", "banned"]).optional(),
});
export const adminUsersResponseSchema = adminPageSchema(adminUserSchema);
export const setAccountTypeSchema = z.object({
  accountType: z.enum(["USER", "AGENT"]),
});
export const banUserSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const adminAccessSchema = z.object({
  accountType: z.enum(["OWNER", "STAFF"]),
  permissions: z.array(z.string()),
  highestRolePosition: z.number().int().nonnegative(),
});

export const staffPermissionSchema = z.object({
  id: idSchema,
  key: z.string(),
  label: z.string(),
  group: z.string(),
  description: z.string().nullable(),
});

export const staffRoleSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  position: z.number().int().nonnegative(),
  permissionKeys: z.array(z.string()),
  memberCount: z.number().int().nonnegative(),
  manageable: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const staffRbacCatalogSchema = z.object({
  roles: z.array(staffRoleSummarySchema),
  permissionGroups: z.array(
    z.object({
      group: z.string(),
      permissions: z.array(staffPermissionSchema),
    }),
  ),
});

export const staffMemberSchema = z.object({
  id: userIdSchema,
  name: z.string(),
  email: z.string().email(),
  accountType: z.enum(["OWNER", "STAFF"]),
  lifecycleStatus: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "PENDING_DELETION",
    "DELETED",
  ]),
  banned: z.boolean(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  membershipStatus: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]).nullable(),
  membershipReason: z.string().nullable(),
  roleIds: z.array(idSchema),
  roles: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      color: z.string(),
      position: z.number().int().nonnegative(),
    }),
  ),
  highestRolePosition: z.number().int().nonnegative(),
  manageable: z.boolean(),
  createdAt: isoDateSchema,
});
export const staffMembersQuerySchema = adminPaginationQuerySchema.extend({
  search: z.string().trim().max(120).default(""),
});
export const staffMembersResponseSchema = adminPageSchema(staffMemberSchema);
export const staffCandidateSchema = z.object({
  id: userIdSchema,
  name: z.string(),
  email: z.string().email(),
});
export const staffCandidatesQuerySchema = z.object({
  search: z.string().trim().min(2).max(120),
});
export const staffCandidatesResponseSchema = z.array(staffCandidateSchema);

const roleNameSchema = z.string().trim().min(2).max(80);
const roleDescriptionSchema = z.string().trim().max(500).nullable().optional();
const roleColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const createStaffRoleSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  color: roleColorSchema.default("#64748b"),
  position: z.number().int().min(0).max(999),
  permissionKeys: z.array(z.string()).max(100).default([]),
});
export const updateStaffRoleSchema = createStaffRoleSchema.omit({
  permissionKeys: true,
});
export const setStaffRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()).max(100),
});
export const createStaffMemberSchema = z.object({
  userId: userIdSchema,
  roleIds: z.array(idSchema).min(1).max(20),
});
export const setStaffMemberRolesSchema = z.object({
  roleIds: z.array(idSchema).min(1).max(20),
});
export const setStaffMembershipStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.status === "SUSPENDED" &&
      (!value.reason || value.reason.length < 3)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A suspension reason of at least 3 characters is required.",
      });
    }
  });

export const platformInvitationTypeSchema = z.enum(["STAFF", "AGENT"]);
export const platformInvitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
]);
export const platformInvitationSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  type: platformInvitationTypeSchema,
  status: platformInvitationStatusSchema,
  roleIds: z.array(idSchema),
  roles: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      color: z.string(),
      position: z.number().int(),
    }),
  ),
  expiresAt: isoDateSchema,
  createdAt: isoDateSchema,
});
export const platformInvitationsQuerySchema = adminPaginationQuerySchema.extend(
  {
    type: platformInvitationTypeSchema.optional(),
    status: platformInvitationStatusSchema.optional(),
  },
);
export const platformInvitationsResponseSchema = adminPageSchema(
  platformInvitationSchema,
);
const invitationEmailSchema = z.string().trim().toLowerCase().email().max(320);

// The request schemas omit `type`: the route decides it, so a client cannot
// submit one type's role rules and have the handler relabel it as the other.
export const createStaffInvitationSchema = z.object({
  email: invitationEmailSchema,
  roleIds: z.array(idSchema).min(1).max(20),
});
export const createAgentInvitationSchema = z.object({
  email: invitationEmailSchema,
});
export const createPlatformInvitationSchema = z
  .object({
    email: invitationEmailSchema,
    type: platformInvitationTypeSchema,
    roleIds: z.array(idSchema).max(20).default([]),
  })
  .superRefine((value, context) => {
    if (value.type === "STAFF" && value.roleIds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["roleIds"],
        message: "A staff invitation requires at least one role.",
      });
    }
    if (value.type === "AGENT" && value.roleIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["roleIds"],
        message: "Agent invitations cannot contain staff roles.",
      });
    }
  });
export const acceptPlatformInvitationSchema = z.object({
  token: z.string().min(32).max(256),
});
export const transferOwnershipSchema = z.object({
  targetUserId: userIdSchema,
  previousOwnerRoleIds: z.array(idSchema).min(1).max(20),
  confirmation: z.literal("TRANSFER OWNERSHIP"),
});

/**
 * Everything the console knows about one account, in the shape the detail page
 * reads it: who they are, what they listed, who they talked to, what they paid.
 */
export const adminUserDetailSchema = z.object({
  id: userIdSchema,
  name: z.string(),
  email: z.string().email(),
  accountType: accountTypeSchema,
  banned: z.boolean(),
  banReason: z.string().nullable(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  lifecycleStatus: z.enum([
    "ACTIVE",
    "SUSPENDED",
    "PENDING_DELETION",
    "DELETED",
  ]),
  image: z.string().url().nullable(),
  phone: z.string().nullable(),
  username: z.string().nullable(),
  createdAt: isoDateSchema,
  lastSeenAt: isoDateSchema.nullable(),
  providers: z.array(z.string()),
  counts: z.object({
    listings: z.number().int().nonnegative(),
    conversations: z.number().int().nonnegative(),
    payments: z.number().int().nonnegative(),
    bids: z.number().int().nonnegative(),
    favorites: z.number().int().nonnegative(),
  }),
  listings: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      status: z.string(),
      type: z.string(),
      priceMinor: z.string().nullable(),
      currency: z.string(),
      createdAt: isoDateSchema,
    }),
  ),
  agents: z.array(
    z.object({
      id: userIdSchema,
      name: z.string(),
      email: z.string().email(),
      /** How the two are connected: a conversation, or a represented listing. */
      via: z.enum(["CONVERSATION", "ASSIGNMENT"]),
      lastContactAt: isoDateSchema.nullable(),
    }),
  ),
  payments: z.array(
    z.object({
      id: idSchema,
      listingId: idSchema,
      listingTitle: z.string(),
      method: z.string(),
      reference: z.string().nullable(),
      amountMinor: z.string(),
      currency: z.string(),
      status: z.string(),
      rejectionReason: z.string().nullable(),
      createdAt: isoDateSchema,
      reviewedAt: isoDateSchema.nullable(),
    }),
  ),
});

export const adminListingSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  status: z.string(),
  type: z.string(),
  propertyType: z.string(),
  owner: z.object({
    id: userIdSchema,
    name: z.string(),
    email: z.string().email(),
  }),
  priceMinor: z.string().nullable(),
  currency: z.string(),
  createdAt: isoDateSchema,
  publishedAt: isoDateSchema.nullable(),
});
export const adminListingsQuerySchema = adminPaginationQuerySchema.extend({
  status: z
    .enum([
      "DRAFT",
      "PENDING_REVIEW",
      "PUBLISHED",
      "REJECTED",
      "WITHDRAWN",
      "ARCHIVED",
    ])
    .optional(),
  type: z.enum(["SALE", "RENT", "AUCTION"]).optional(),
});
export const adminListingsResponseSchema = adminPageSchema(adminListingSchema);
export const listingModerationDecisionSchema = z.object({
  decision: z.enum(["PUBLISH", "REJECT"]),
  reason: z.string().trim().max(1000).optional(),
});

export const adminAuctionSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  title: z.string(),
  status: z.string(),
  currency: z.string().length(3),
  currentAmountMinor: z.string(),
  bidCount: z.number().int(),
  startsAt: isoDateSchema,
  endsAt: isoDateSchema,
});
export const adminAuctionsQuerySchema = adminPaginationQuerySchema.extend({
  status: z
    .enum([
      "DRAFT",
      "SCHEDULED",
      "LIVE",
      "PAUSED",
      "ENDED",
      "AWAITING_SETTLEMENT",
      "SETTLED",
      "CANCELLED",
      "VOIDED",
    ])
    .optional(),
});
export const adminAuctionsResponseSchema = adminPageSchema(adminAuctionSchema);

export const adminAuctionActionSchema = z
  .object({
    action: z.enum(["PAUSE", "RESUME", "CANCEL"]),
    reason: z.string().trim().min(3).max(1000).optional(),
  })
  .superRefine((value, context) => {
    if (value.action === "CANCEL" && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A cancellation reason is required.",
      });
    }
  });

export const moderationItemSchema = z.object({
  id: idSchema,
  kind: z.enum(["LISTING_REPORT", "USER_REPORT"]),
  // A user report points at a user id, a listing report at a listing uuid.
  subjectId: userIdSchema,
  subjectLabel: z.string(),
  reporter: z.object({
    id: userIdSchema,
    name: z.string(),
    email: z.string().email(),
  }),
  reason: z.string(),
  details: z.string().nullable(),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]),
  createdAt: isoDateSchema,
});
export const moderationQueueResponseSchema =
  adminPageSchema(moderationItemSchema);
export const moderationDecisionSchema = z.object({
  status: z.enum(["IN_REVIEW", "RESOLVED", "DISMISSED"]),
  reason: z.string().trim().min(3).max(1000),
});

export const adminAgentSchema = z.object({
  id: idSchema,
  userId: userIdSchema,
  name: z.string(),
  email: z.string().email(),
  licenseNumber: z.string().nullable(),
  verifiedAt: isoDateSchema.nullable(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "RETIRED"]),
  availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "AT_CAPACITY"]),
  maxActiveCases: z.number().int().min(0).max(1000),
  statusReason: z.string().nullable(),
  averageRating: z.number(),
  reviewCount: z.number().int().nonnegative(),
  activeListings: z.number().int().nonnegative(),
  createdAt: isoDateSchema,
});
export const adminAgentsResponseSchema = adminPageSchema(adminAgentSchema);
export const createAgentSchema = z.object({ userId: userIdSchema });
export const setAgentStatusSchema = z
  .object({
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "RETIRED"]),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      ["SUSPENDED", "RETIRED"].includes(value.status) &&
      (!value.reason || value.reason.length < 3)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason of at least 3 characters is required.",
      });
    }
  });
export const setAgentAvailabilitySchema = z.object({
  availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE", "AT_CAPACITY"]),
  maxActiveCases: z.number().int().min(0).max(1000),
});

export const adminAuditSchema = z.object({
  id: idSchema,
  actor: z
    .object({ id: userIdSchema, name: z.string(), email: z.string().email() })
    .nullable(),
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
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "RETIRED"]).optional(),
  availabilityStatus: z
    .enum(["AVAILABLE", "UNAVAILABLE", "AT_CAPACITY"])
    .optional(),
});
export const adminAuditQuerySchema = adminPaginationQuerySchema.extend({
  action: z
    .enum([
      "USER_CREATED",
      "USER_UPDATED",
      "PROFILE_UPDATED",
      "USER_ROLE_CHANGED",
      "ACCOUNT_TYPE_CHANGED",
      "USER_BANNED",
      "USER_UNBANNED",
      "USER_DELETION_REQUESTED",
      "USER_DELETED",
      "LISTING_CREATED",
      "LISTING_SUBMITTED",
      "LISTING_PUBLISHED",
      "LISTING_REJECTED",
      "LISTING_WITHDRAWN",
      "AUCTION_CREATED",
      "AUCTION_STARTED",
      "AUCTION_PAUSED",
      "AUCTION_RESUMED",
      "AUCTION_ENDED",
      "AUCTION_CANCELLED",
      "BID_ACCEPTED",
      "ADMIN_IMPERSONATION_STARTED",
      "ADMIN_IMPERSONATION_ENDED",
      "MEDIA_REJECTED",
      "REPORT_REVIEWED",
      "SETTINGS_UPDATED",
      "STAFF_ROLE_CREATED",
      "STAFF_ROLE_UPDATED",
      "STAFF_ROLE_DELETED",
      "STAFF_ROLE_PERMISSIONS_UPDATED",
      "STAFF_ROLE_ASSIGNED",
      "STAFF_ROLE_REMOVED",
      "STAFF_MEMBER_CREATED",
      "STAFF_STATUS_CHANGED",
      "PLATFORM_INVITATION_CREATED",
      "PLATFORM_INVITATION_REVOKED",
      "PLATFORM_INVITATION_ACCEPTED",
      "AGENT_CREATED",
      "AGENT_STATUS_CHANGED",
      "AGENT_AVAILABILITY_CHANGED",
      "OWNER_TRANSFERRED",
    ])
    .optional(),
  entityType: z.string().trim().max(80).optional(),
});

export const adminMessageSchema = z.object({
  id: idSchema,
  type: z.string(),
  participants: z.array(
    z.object({ id: userIdSchema, name: z.string(), email: z.string().email() }),
  ),
  lastMessage: z
    .object({ body: z.string(), createdAt: isoDateSchema })
    .nullable(),
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
    /** Owner payments waiting on a moderator. */
    paymentsAwaitingReview: z.number().int().nonnegative(),
    /** Verified listings with no agent offered yet. */
    listingsAwaitingAgent: z.number().int().nonnegative(),
    /** Offers sent but not yet answered by an agent. */
    openAgentOffers: z.number().int().nonnegative(),
  }),
  /**
   * One row per day for the trailing window, oldest first. Drives the pulse
   * chart and the activity heatmap; days with nothing still appear so the
   * shape of a quiet week is visible rather than compressed away.
   */
  daily: z.array(
    z.object({
      date: z.string(),
      listings: z.number().int().nonnegative(),
      bids: z.number().int().nonnegative(),
      signups: z.number().int().nonnegative(),
      events: z.number().int().nonnegative(),
    }),
  ),
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
