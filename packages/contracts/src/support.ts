import { z } from "zod";
import { cursorQuerySchema, idSchema, isoDateSchema } from "./common";

export const supportAuthorRoleSchema = z.enum(["VISITOR", "STAFF"]);
export const supportThreadStatusSchema = z.enum([
  "OPEN",
  "ASSIGNED",
  "CLOSED",
]);

/**
 * How long an anonymous thread survives after its last message. The window
 * slides on every message, so a live conversation is never cut off mid-flow.
 */
export const ANONYMOUS_THREAD_TTL_MINUTES = 30;

export const supportMessageSchema = z.object({
  id: idSchema,
  authorRole: supportAuthorRoleSchema,
  authorName: z.string().nullable(),
  body: z.string(),
  createdAt: isoDateSchema,
});

export const supportThreadSchema = z.object({
  id: idSchema,
  status: supportThreadStatusSchema,
  subject: z.string().nullable(),
  /** Null for signed-in threads, which are kept with the account. */
  expiresAt: isoDateSchema.nullable(),
  lastMessageAt: isoDateSchema,
  messages: z.array(supportMessageSchema),
});

export const sendSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const supportThreadSummarySchema = z.object({
  id: idSchema,
  status: supportThreadStatusSchema,
  subject: z.string().nullable(),
  /** "Guest" when the visitor has never signed in. */
  visitorName: z.string(),
  visitorEmail: z.string().nullable(),
  assignedToName: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: isoDateSchema,
  expiresAt: isoDateSchema.nullable(),
});

export const supportThreadListSchema = z.object({
  items: z.array(supportThreadSummarySchema),
  nextCursor: z.string().nullable(),
});

export const supportThreadQuerySchema = cursorQuerySchema.extend({
  status: supportThreadStatusSchema.optional(),
  /** Restrict to threads assigned to the calling staff member. */
  mine: z.coerce.boolean().optional(),
});

export const assignSupportThreadSchema = z.object({
  assigneeId: idSchema.nullable(),
});

export type SupportThread = z.infer<typeof supportThreadSchema>;
export type SupportThreadSummary = z.infer<typeof supportThreadSummarySchema>;
