import { z } from "zod";

const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;

export const idSchema = z.uuid();
export const isoDateSchema = z.iso.datetime({ offset: true });

export const minorAmountSchema = z
  .string()
  .regex(/^\d{1,19}$/, "Amount must be an unsigned integer in minor units.")
  .refine((value) => BigInt(value) <= POSTGRES_BIGINT_MAX, {
    message: "Amount exceeds the supported database range.",
  });

export const positiveMinorAmountSchema = minorAmountSchema.refine(
  (value) => BigInt(value) > 0n,
  { message: "Amount must be greater than zero." },
);

export const moneySchema = z.object({
  amountMinor: positiveMinorAmountSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const queryBooleanSchema = z.preprocess((value) => {
  if (value === undefined || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return value;
}, z.boolean());

export const bigintQuerySchema = z.preprocess((value) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d{1,19}$/.test(value)) {
    return BigInt(value);
  }
  return value;
}, z.bigint().nonnegative().max(POSTGRES_BIGINT_MAX));

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  details: z.unknown().optional(),
});

export const cursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });

export const adminPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    pageCount: z.number().int().nonnegative(),
  });

export const cursorQuerySchema = z.object({
  cursor: z.string().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  sort: z.string().trim().max(50).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type Money = z.infer<typeof moneySchema>;
