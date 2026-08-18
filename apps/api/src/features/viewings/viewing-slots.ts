import {
  NEPAL_UTC_OFFSET_MINUTES,
  VIEWING_SLOT_STEP_MINUTES,
} from "@real-estate/contracts";

export type Window = { dayOfWeek: number; startMinute: number; endMinute: number };
export type Busy = { startsAt: Date; endsAt: Date };
export type Slot = { startsAt: Date; label: string };
export type SlotDay = { date: string; label: string; slots: Slot[] };

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Local Nepal midnight for the day `offsetDays` from now, as a UTC instant.
 * Nepal keeps a fixed UTC+05:45 with no daylight saving, so shifting by the
 * offset is exact rather than an approximation.
 */
function localMidnightUtc(from: Date, offsetDays: number): Date {
  const local = new Date(from.getTime() + NEPAL_UTC_OFFSET_MINUTES * MINUTE_MS);
  const midnightLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  return new Date(
    midnightLocal + offsetDays * DAY_MS - NEPAL_UTC_OFFSET_MINUTES * MINUTE_MS,
  );
}

/** The local calendar parts of an instant, for labelling and day-of-week. */
function localParts(instant: Date) {
  const local = new Date(instant.getTime() + NEPAL_UTC_OFFSET_MINUTES * MINUTE_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    dayOfWeek: local.getUTCDay(),
    minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function timeLabel(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const suffix = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${pad(minute)} ${suffix}`;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Overlapping or touching windows on the same day are merged, so an agent who
 * saves 09:00-12:00 and 11:00-14:00 gets one 09:00-14:00 run rather than
 * duplicate slots at 11:00 and 11:30.
 */
function mergeWindows(windows: Window[]): Map<number, Window[]> {
  const byDay = new Map<number, Window[]>();
  for (const window of windows) {
    const day = byDay.get(window.dayOfWeek) ?? [];
    day.push(window);
    byDay.set(window.dayOfWeek, day);
  }

  for (const [day, list] of byDay) {
    list.sort((left, right) => left.startMinute - right.startMinute);
    const merged: Window[] = [];
    for (const window of list) {
      const previous = merged.at(-1);
      if (previous && window.startMinute <= previous.endMinute) {
        previous.endMinute = Math.max(previous.endMinute, window.endMinute);
        continue;
      }
      merged.push({ ...window });
    }
    byDay.set(day, merged);
  }
  return byDay;
}

/**
 * Expands weekly windows into concrete slots, dropping anything that is in the
 * past, inside the notice period, or overlapping a viewing already on the books.
 */
export function buildSlots(input: {
  windows: Window[];
  busy: Busy[];
  days: number;
  durationMinutes: number;
  leadMinutes: number;
  now?: Date;
}): SlotDay[] {
  const now = input.now ?? new Date();
  const earliest = new Date(now.getTime() + input.leadMinutes * MINUTE_MS);
  const byDay = mergeWindows(input.windows);
  const result: SlotDay[] = [];

  for (let offset = 0; offset < input.days; offset++) {
    const midnight = localMidnightUtc(now, offset);
    const parts = localParts(midnight);
    const windows = byDay.get(parts.dayOfWeek) ?? [];
    const slots: Slot[] = [];

    for (const window of windows) {
      const lastStart = window.endMinute - input.durationMinutes;
      for (
        let minute = window.startMinute;
        minute <= lastStart;
        minute += VIEWING_SLOT_STEP_MINUTES
      ) {
        const startsAt = new Date(midnight.getTime() + minute * MINUTE_MS);
        if (startsAt < earliest) continue;

        const endsAt = new Date(
          startsAt.getTime() + input.durationMinutes * MINUTE_MS,
        );
        const taken = input.busy.some(
          (booked) => startsAt < booked.endsAt && endsAt > booked.startsAt,
        );
        if (taken) continue;

        slots.push({ startsAt, label: timeLabel(minute) });
      }
    }

    if (slots.length === 0) continue;

    result.push({
      date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
      label: `${DAY_NAMES[parts.dayOfWeek]}, ${parts.day} ${MONTH_NAMES[parts.month - 1]}`,
      slots,
    });
  }

  return result;
}

/** Whether an instant lands exactly on one of the agent's offered slots. */
export function isOfferedSlot(startsAt: Date, days: SlotDay[]): boolean {
  const target = startsAt.getTime();
  return days.some((day) =>
    day.slots.some((slot) => slot.startsAt.getTime() === target),
  );
}
