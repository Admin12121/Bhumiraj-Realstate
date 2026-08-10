import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@real-estate/database";
import { idSchema } from "@real-estate/contracts";
import { z } from "zod";
import { assertActiveAccount } from "../../shared/auth/account-policy";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";

const dateCursorSchema = z
  .object({ createdAt: z.iso.datetime({ offset: true }), id: idSchema })
  .strict();
@Injectable()
export class ViewingsService {
  async create(
    userId: string,
    listingId: string,
    input: { scheduledAt: string; notes?: string },
  ) {
    await assertActiveAccount(userId, { requireVerifiedEmail: true });
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt.getTime() < Date.now() + 30 * 60 * 1000) {
      throw new ConflictException({
        code: "VIEWING_TIME_INVALID",
        message: "Choose a viewing time at least 30 minutes in the future.",
      });
    }
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
      select: { createdById: true },
    });
    if (!listing) throw new NotFoundException();
    if (listing.createdById === userId) {
      throw new ConflictException({
        code: "OWNER_VIEWING_NOT_ALLOWED",
        message: "You cannot request a viewing for your own listing.",
      });
    }

    return prisma.$transaction(async (tx) => {
      const viewing = await tx.viewingRequest.create({
        data: {
          listingId,
          requesterId: userId,
          scheduledAt,
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
      });
      const notification = await tx.notification.create({
        data: {
          userId: listing.createdById,
          type: "viewing.requested",
          title: "New viewing request",
          body: "A buyer requested a property viewing.",
          data: { viewingId: viewing.id, listingId },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "Notification",
          aggregateId: notification.id,
          eventType: "notification.created",
          payload: {
            userId: listing.createdById,
            notificationId: notification.id,
          },
        },
      });
      return {
        ...viewing,
        scheduledAt: viewing.scheduledAt.toISOString(),
        createdAt: viewing.createdAt.toISOString(),
        updatedAt: viewing.updatedAt.toISOString(),
      };
    });
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
      include: { listing: { select: { title: true, slug: true } } },
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      ...row,
      scheduledAt: row.scheduledAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    const last = items.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }
}
