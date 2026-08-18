import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@real-estate/database";
import {
  VIEWING_DURATION_MINUTES,
  VIEWING_MIN_LEAD_MINUTES,
  idSchema,
} from "@real-estate/contracts";
import { z } from "zod";
import { assertActiveAccount } from "../../shared/auth/account-policy";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";
import { notify } from "../../shared/notifications/notify";
import { buildSlots, isOfferedSlot } from "./viewing-slots";

const dateCursorSchema = z
  .object({ createdAt: z.iso.datetime({ offset: true }), id: idSchema })
  .strict();

/** Statuses that still occupy the agent's calendar. */
const BLOCKING_STATUSES = ["REQUESTED", "CONFIRMED"] as const;

type ViewingRow = {
  id: string;
  listingId: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  notes: string | null;
  responseNote: string | null;
  createdAt: Date;
  listing: { title: string; slug: string };
  requester: { name: string };
};

@Injectable()
export class ViewingsService {
  /** The agent currently representing a published listing, if any. */
  private async representingAgent(listingId: string) {
    const assignment = await prisma.listingAssignment.findFirst({
      where: { listingId, status: "ACCEPTED" },
      select: {
        agent: {
          select: { id: true, userId: true, user: { select: { name: true } } },
        },
      },
    });
    return assignment?.agent ?? null;
  }

  private toViewing(row: ViewingRow) {
    return {
      id: row.id,
      listingId: row.listingId,
      listingTitle: row.listing.title,
      listingSlug: row.listing.slug,
      requesterName: row.requester.name,
      scheduledAt: row.scheduledAt.toISOString(),
      durationMinutes: row.durationMinutes,
      status: row.status,
      notes: row.notes,
      responseNote: row.responseNote,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Bookable slots for a listing, derived from the representing agent's weekly
   * availability minus the viewings already on their calendar.
   */
  async slots(listingSlug: string, days: number) {
    const listing = await prisma.listing.findFirst({
      where: { slug: listingSlug, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException();

    const agent = await this.representingAgent(listing.id);
    const empty = {
      timezone: "Asia/Kathmandu",
      durationMinutes: VIEWING_DURATION_MINUTES,
      agent: null,
      days: [],
    };
    if (!agent) return empty;

    const [windows, busy] = await Promise.all([
      prisma.agentAvailabilityWindow.findMany({
        where: { agentId: agent.id },
        select: { dayOfWeek: true, startMinute: true, endMinute: true },
      }),
      prisma.viewingRequest.findMany({
        where: {
          agentId: agent.id,
          status: { in: [...BLOCKING_STATUSES] },
          scheduledAt: { gte: new Date() },
        },
        select: { scheduledAt: true, durationMinutes: true },
      }),
    ]);

    const slotDays = buildSlots({
      windows,
      busy: busy.map((row) => ({
        startsAt: row.scheduledAt,
        endsAt: new Date(
          row.scheduledAt.getTime() + row.durationMinutes * 60_000,
        ),
      })),
      days,
      durationMinutes: VIEWING_DURATION_MINUTES,
      leadMinutes: VIEWING_MIN_LEAD_MINUTES,
    });

    return {
      timezone: "Asia/Kathmandu",
      durationMinutes: VIEWING_DURATION_MINUTES,
      agent: { id: agent.id, userId: agent.userId, name: agent.user.name },
      days: slotDays.map((day) => ({
        date: day.date,
        label: day.label,
        slots: day.slots.map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          label: slot.label,
        })),
      })),
    };
  }

  /** Books one of the offered slots. */
  async request(
    userId: string,
    listingSlug: string,
    input: { startsAt: string; notes?: string },
  ) {
    await assertActiveAccount(userId, { requireVerifiedEmail: true });

    const listing = await prisma.listing.findFirst({
      where: { slug: listingSlug, status: "PUBLISHED" },
      select: { id: true, title: true, createdById: true },
    });
    if (!listing) throw new NotFoundException();
    if (listing.createdById === userId) {
      throw new ConflictException({
        code: "OWNER_VIEWING_NOT_ALLOWED",
        message: "You cannot request a viewing for your own listing.",
      });
    }

    const agent = await this.representingAgent(listing.id);
    if (!agent) {
      throw new ConflictException({
        code: "NO_AGENT_ASSIGNED",
        message: "This property does not have an agent to show it yet.",
      });
    }

    // Re-deriving the slots is the authorisation check: a time the agent never
    // offered, or that someone booked in the meantime, simply is not in the set.
    const offered = await this.slots(listingSlug, 21);
    const startsAt = new Date(input.startsAt);
    const offeredDays = offered.days.map((day) => ({
      date: day.date,
      label: day.label,
      slots: day.slots.map((slot) => ({
        startsAt: new Date(slot.startsAt),
        label: slot.label,
      })),
    }));
    if (!isOfferedSlot(startsAt, offeredDays)) {
      throw new ConflictException({
        code: "SLOT_UNAVAILABLE",
        message: "That time is no longer available. Pick another slot.",
      });
    }

    return prisma.$transaction(async (tx) => {
      // The unique guard the slot re-derivation cannot give us: two buyers
      // hitting the same free slot at once.
      const clash = await tx.viewingRequest.findFirst({
        where: {
          agentId: agent.id,
          scheduledAt: startsAt,
          status: { in: [...BLOCKING_STATUSES] },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException({
          code: "SLOT_UNAVAILABLE",
          message: "That time was just taken. Pick another slot.",
        });
      }

      const viewing = await tx.viewingRequest.create({
        data: {
          listingId: listing.id,
          requesterId: userId,
          agentId: agent.id,
          scheduledAt: startsAt,
          durationMinutes: VIEWING_DURATION_MINUTES,
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
        select: {
          id: true,
          listingId: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          notes: true,
          responseNote: true,
          createdAt: true,
          listing: { select: { title: true, slug: true } },
          requester: { select: { name: true } },
        },
      });

      await notify(tx, {
        userId: agent.userId,
        type: "viewing.requested",
        title: "New viewing request",
        body: `${viewing.requester.name} asked to view "${listing.title}" on ${startsAt.toISOString()}.`,
        data: { viewingId: viewing.id, listingId: listing.id },
      });

      return this.toViewing(viewing);
    });
  }

  /** The agent confirms or declines; either way the buyer hears back. */
  async respond(
    viewingId: string,
    userId: string,
    input: { decision: "CONFIRM" | "DECLINE"; note?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const viewing = await tx.viewingRequest.findUnique({
        where: { id: viewingId },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          requesterId: true,
          agent: { select: { userId: true } },
          listing: { select: { title: true, slug: true } },
        },
      });
      if (!viewing) throw new NotFoundException();
      if (viewing.agent?.userId !== userId) {
        throw new ForbiddenException({
          code: "NOT_VIEWING_AGENT",
          message: "This viewing belongs to another agent.",
        });
      }
      if (viewing.status !== "REQUESTED") {
        throw new ConflictException({
          code: "VIEWING_CLOSED",
          message: "This viewing has already been answered.",
        });
      }

      const confirmed = input.decision === "CONFIRM";
      await tx.viewingRequest.update({
        where: { id: viewing.id },
        data: {
          status: confirmed ? "CONFIRMED" : "CANCELLED",
          respondedAt: new Date(),
          responseNote: input.note ?? null,
        },
      });

      await notify(tx, {
        userId: viewing.requesterId,
        type: confirmed ? "viewing.confirmed" : "viewing.declined",
        title: confirmed ? "Your viewing is confirmed" : "Viewing not available",
        body: confirmed
          ? `The agent confirmed your viewing of "${viewing.listing.title}".`
          : `The agent could not take your viewing of "${viewing.listing.title}". ${input.note ?? ""}`.trim(),
        data: { viewingId: viewing.id },
      });

      return {
        id: viewing.id,
        status: confirmed ? "CONFIRMED" : "CANCELLED",
      };
    });
  }

  /** The agent's own calendar. */
  async forAgent(userId: string, status?: string) {
    const agent = await prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException({
        code: "NOT_AN_AGENT",
        message: "This account is not an agent.",
      });
    }

    const rows = await prisma.viewingRequest.findMany({
      where: {
        agentId: agent.id,
        ...(status ? { status: status as "REQUESTED" } : {}),
      },
      orderBy: [{ scheduledAt: "asc" }],
      take: 100,
      select: {
        id: true,
        listingId: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        notes: true,
        responseNote: true,
        createdAt: true,
        listing: { select: { title: true, slug: true } },
        requester: { select: { name: true } },
      },
    });

    return { items: rows.map((row) => this.toViewing(row)) };
  }

  async availability(userId: string) {
    const agent = await prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException({
        code: "NOT_AN_AGENT",
        message: "This account is not an agent.",
      });
    }

    const windows = await prisma.agentAvailabilityWindow.findMany({
      where: { agentId: agent.id },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      select: {
        id: true,
        dayOfWeek: true,
        startMinute: true,
        endMinute: true,
      },
    });
    return { windows };
  }

  /**
   * Replaces the whole weekly schedule. Editing as a set keeps the saved state
   * identical to what the agent sees, with no partial-update ordering to reason
   * about.
   */
  async setAvailability(
    userId: string,
    windows: { dayOfWeek: number; startMinute: number; endMinute: number }[],
  ) {
    const agent = await prisma.agentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!agent) {
      throw new ForbiddenException({
        code: "NOT_AN_AGENT",
        message: "This account is not an agent.",
      });
    }

    // Two windows on the same day starting at the same minute collide on the
    // unique index; reject it with a message rather than a constraint error.
    const seen = new Set<string>();
    for (const window of windows) {
      const key = `${window.dayOfWeek}:${window.startMinute}`;
      if (seen.has(key)) {
        throw new ConflictException({
          code: "DUPLICATE_WINDOW",
          message: "Two windows on the same day start at the same time.",
        });
      }
      seen.add(key);
    }

    await prisma.$transaction([
      prisma.agentAvailabilityWindow.deleteMany({
        where: { agentId: agent.id },
      }),
      ...(windows.length
        ? [
            prisma.agentAvailabilityWindow.createMany({
              data: windows.map((window) => ({ ...window, agentId: agent.id })),
            }),
          ]
        : []),
      prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "AGENT_AVAILABILITY_CHANGED",
          entityType: "AgentProfile",
          entityId: agent.id,
          after: { windows: windows.length },
        },
      }),
    ]);

    return this.availability(userId);
  }

  async mine(userId: string, cursor?: string, limit = 20) {
    const decoded = decodeCursor(cursor, dateCursorSchema);
    const createdAt = decoded ? new Date(decoded.createdAt) : undefined;
    const rows = await prisma.viewingRequest.findMany({
      where: {
        requesterId: userId,
        ...(decoded && createdAt
          ? {
              OR: [
                { createdAt: { lt: createdAt } },
                { createdAt, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        listingId: true,
        scheduledAt: true,
        durationMinutes: true,
        status: true,
        notes: true,
        responseNote: true,
        createdAt: true,
        listing: { select: { title: true, slug: true } },
        requester: { select: { name: true } },
      },
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.toViewing(row)),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }
}
