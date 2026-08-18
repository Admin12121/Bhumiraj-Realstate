import { z } from "zod";
import { idSchema, isoDateSchema, userIdSchema } from "./common";

export const userProfileSchema = z.object({
  id: idSchema,
  name: z.string(),
  username: z.string().nullable(),
  email: z.string().email().optional(),
  image: z.string().url().nullable(),
  coverImage: z.string().url().nullable(),
  bio: z.string().nullable(),
  phone: z.string().nullable().optional(),
  role: z.string(),
  verified: z.boolean(),
  isSelf: z.boolean().default(false),
  followedByMe: z.boolean().default(false),
  joinedAt: isoDateSchema,
  stats: z.object({
    listings: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
    saved: z.number().int().nonnegative().optional(),
  }),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/)
    .optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  imageAssetId: idSchema.nullable().optional(),
  coverAssetId: idSchema.nullable().optional(),
});

export const followProfileResponseSchema = z.object({
  followed: z.boolean(),
  followerCount: z.number().int().nonnegative(),
});

export const publicAgentSchema = z.object({
  id: idSchema,
  userId: userIdSchema,
  name: z.string(),
  username: z.string().nullable(),
  image: z.string().url().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  verified: z.boolean(),
  averageRating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  listingCount: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
  followedByMe: z.boolean(),
});

export const publicAgentsQuerySchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(100).optional(),
});

export const publicAgentsResponseSchema = z.object({
  items: z.array(publicAgentSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

/** Full agent profile: identity, standing, and the properties they represent. */
export const agentProfileDetailSchema = z.object({
  id: idSchema,
  userId: userIdSchema,
  name: z.string(),
  username: z.string().nullable(),
  image: z.url().nullable(),
  headline: z.string().nullable(),
  about: z.string().nullable(),
  verified: z.boolean(),
  status: z.string(),
  availabilityStatus: z.string(),
  averageRating: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
  followedByMe: z.boolean(),
  isSelf: z.boolean(),
  joinedAt: isoDateSchema,
  /** Properties currently represented by this agent. */
  listings: z.array(
    z.object({
      id: idSchema,
      slug: z.string(),
      title: z.string(),
      coverImageUrl: z.url().nullable(),
      locality: z.string(),
      district: z.string(),
      priceMinor: z.string().nullable(),
      currency: z.string().nullable(),
      listingType: z.string(),
      bedrooms: z.number().int().nullable(),
      bathrooms: z.number().int().nullable(),
    }),
  ),
  reviews: z.array(
    z.object({
      id: idSchema,
      rating: z.number().int().min(1).max(5),
      comment: z.string().nullable(),
      authorName: z.string(),
      createdAt: isoDateSchema,
    }),
  ),
});

export type AgentProfileDetail = z.infer<typeof agentProfileDetailSchema>;
