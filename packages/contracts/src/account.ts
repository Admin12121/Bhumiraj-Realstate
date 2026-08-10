import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export const accountSessionSchema = z.object({
  id: idSchema,
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  current: z.boolean(),
});
export const accountOverviewSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  role: z.string(),
  twoFactorEnabled: z.boolean(),
  lifecycleStatus: z.enum(["ACTIVE", "SUSPENDED", "PENDING_DELETION", "DELETED"]),
  deletionRequestedAt: isoDateSchema.nullable(),
  providers: z.array(z.string()),
  passkeyCount: z.number().int().nonnegative(),
  sessionCount: z.number().int().nonnegative(),
});
export const requestDeletionSchema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }).strict();
export const cancelDeletionSchema = z.object({ confirmation: z.literal("KEEP MY ACCOUNT") });
