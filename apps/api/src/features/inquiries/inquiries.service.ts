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
export class InquiriesService {
  async create(userId: string, listingId: string, message: string) {
    await assertActiveAccount(userId, { requireVerifiedEmail: true });
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
      select: { createdById: true },
    });
    if (!listing) throw new NotFoundException();
    if (listing.createdById === userId) {
      throw new ConflictException({
        code: "OWNER_INQUIRY_NOT_ALLOWED",
        message: "You cannot send an inquiry to your own listing.",
      });
    }

    return prisma.$transaction(async (tx) => {
      const inquiry = await tx.listingInquiry.create({
        data: {
          listingId,
          userId,
          assignedAgentId: listing.createdById,
          message,
        },
      });
      await tx.listing.update({
        where: { id: listingId },
        data: { inquiryCount: { increment: 1 } },
      });
      const notification = await tx.notification.create({
        data: {
          userId: listing.createdById,
          type: "listing.inquiry.created",
          title: "New property inquiry",
          body: message.slice(0, 120),
          data: { inquiryId: inquiry.id, listingId },
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
        ...inquiry,
        createdAt: inquiry.createdAt.toISOString(),
        updatedAt: inquiry.updatedAt.toISOString(),
      };
    });
  }

  async mine(userId: string, cursor?: string, limit = 20) {
    const decoded = decodeCursor(cursor, dateCursorSchema);
    const createdAt = decoded ? new Date(decoded.createdAt) : undefined;
    const rows = await prisma.listingInquiry.findMany({
      where: {
        userId,
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
