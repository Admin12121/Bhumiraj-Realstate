import { z } from "zod";
import { cursorQuerySchema, idSchema, isoDateSchema, userIdSchema } from "./common";

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
  attachmentUrl: z.string().nullable(),
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
  /** A READY image the sender owns; validated server-side before it attaches. */
  attachmentId: idSchema.optional(),
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
  /** Matches the visitor's name or email, or the thread subject. */
  search: z.string().trim().max(120).optional(),
});

/** A staff member with the thread open right now, from the presence cache. */
export const supportThreadViewerSchema = z.object({
  id: userIdSchema,
  name: z.string(),
  image: z.string().nullable(),
  /** The one viewer allowed to reply: whoever opened it first. */
  holder: z.boolean(),
});
export type SupportThreadViewer = z.infer<typeof supportThreadViewerSchema>;

export const assignSupportThreadSchema = z.object({
  assigneeId: userIdSchema.nullable(),
});

export type SupportThread = z.infer<typeof supportThreadSchema>;
export type SupportThreadSummary = z.infer<typeof supportThreadSummarySchema>;

/** Chat images are small by design; listing photos have their own, larger cap. */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
