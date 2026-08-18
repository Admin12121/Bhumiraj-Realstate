import { z } from "zod";
import { idSchema, isoDateSchema, userIdSchema } from "./common";

/**
 * Nepal Standard Time is UTC+05:45 year round; the country has never observed
 * daylight saving. Treating the offset as a constant lets a local minute map to
 * exactly one instant without shipping a timezone database.
 */
export const NEPAL_UTC_OFFSET_MINUTES = 345;

/** Slots start on this grid, so a window of 09:00-17:00 yields 09:00, 09:30... */
export const VIEWING_SLOT_STEP_MINUTES = 30;
export const VIEWING_DURATION_MINUTES = 30;

/** How far ahead a buyer may book, and the notice an agent is owed. */
export const VIEWING_MIN_LEAD_MINUTES = 120;
export const VIEWING_MAX_DAYS_AHEAD = 21;

export const viewingStatusSchema = z.enum([
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

const minuteOfDaySchema = z.number().int().min(0).max(1440);

export const availabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: minuteOfDaySchema,
    endMinute: minuteOfDaySchema,
  })
  .strict()
  .refine((window) => window.startMinute < window.endMinute, {
    message: "A window must end after it starts.",
    path: ["endMinute"],
  });

export const setAvailabilitySchema = z
  .object({ windows: z.array(availabilityWindowSchema).max(40) })
  .strict();

export const availabilityResponseSchema = z.object({
  windows: z.array(
    z.object({
      id: idSchema,
      dayOfWeek: z.number().int().min(0).max(6),
      startMinute: minuteOfDaySchema,
      endMinute: minuteOfDaySchema,
    }),
  ),
});

export const viewingSlotQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(VIEWING_MAX_DAYS_AHEAD).default(14),
  })
  .strict();

export const viewingSlotsSchema = z.object({
  timezone: z.string(),
  durationMinutes: z.number().int(),
  agent: z
    .object({ id: idSchema, name: z.string(), userId: userIdSchema })
    .nullable(),
  days: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      slots: z.array(z.object({ startsAt: isoDateSchema, label: z.string() })),
    }),
  ),
});

export const requestViewingSchema = z
  .object({
    startsAt: isoDateSchema,
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const viewingSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  listingTitle: z.string(),
  listingSlug: z.string(),
  requesterName: z.string(),
  scheduledAt: isoDateSchema,
  durationMinutes: z.number().int(),
  status: viewingStatusSchema,
  notes: z.string().nullable(),
  responseNote: z.string().nullable(),
  createdAt: isoDateSchema,
});

export const viewingListSchema = z.object({ items: z.array(viewingSchema) });

export const respondToViewingSchema = z
  .object({
    decision: z.enum(["CONFIRM", "DECLINE"]),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((input) => input.decision === "CONFIRM" || Boolean(input.note), {
    message: "A note is required when declining a viewing.",
    path: ["note"],
  });

export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>;
export type ViewingSlots = z.infer<typeof viewingSlotsSchema>;
export type Viewing = z.infer<typeof viewingSchema>;
