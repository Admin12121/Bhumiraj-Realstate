import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@real-estate/database";
import { idSchema } from "@real-estate/contracts";
import { z } from "zod";
import { assertActiveAccount } from "../../shared/auth/account-policy";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";

const favoriteCursorSchema = z
  .object({ createdAt: z.iso.datetime({ offset: true }), listingId: idSchema })
  .strict();

@Injectable()
export class FavoritesService {
  async list(userId: string, cursor?: string, limit = 20) {
    const decoded = decodeCursor(cursor, favoriteCursorSchema);
    const createdAt = decoded ? new Date(decoded.createdAt) : undefined;

    const rows = await prisma.favorite.findMany({
      where: {
        userId,
        ...(decoded && createdAt
          ? {
              OR: [
                { createdAt: { lt: createdAt } },
                { createdAt, listingId: { lt: decoded.listingId } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { listingId: "desc" }],
      take: limit + 1,
      select: {
        listingId: true,
        createdAt: true,
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            priceMinor: true,
            currency: true,
            media: {
              take: 1,
              orderBy: { position: "asc" },
              select: {
                mediaAsset: {
                  select: {
                    objectKey: true,
                    variants: {
                      where: { name: "card" },
                      take: 1,
                      select: { objectKey: true },
                    },
                  },
                },
              },
            },
            property: {
              select: {
                address: { select: { locality: true, district: true } },
              },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      listingId: row.listingId,
      createdAt: row.createdAt.toISOString(),
      listing: {
        ...row.listing,
        priceMinor: row.listing.priceMinor?.toString() ?? null,
        coverImageKey:
          row.listing.media[0]?.mediaAsset.variants[0]?.objectKey ??
          row.listing.media[0]?.mediaAsset.objectKey ??
          null,
      },
    }));
    const last = items.at(-1);

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              createdAt: last.createdAt,
              listingId: last.listingId,
            })
          : null,
    };
  }

  async add(userId: string, listingId: string) {
    await assertActiveAccount(userId);
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException();

    return prisma.$transaction(async (tx) => {
      const result = await tx.favorite.createMany({
        data: [{ userId, listingId }],
        skipDuplicates: true,
      });
      if (result.count > 0) {
        await tx.listing.update({
          where: { id: listingId },
          data: { favoriteCount: { increment: 1 } },
        });
      }
      return { saved: true };
    });
  }

  async remove(userId: string, listingId: string) {
    await assertActiveAccount(userId);
    return prisma.$transaction(async (tx) => {
      const result = await tx.favorite.deleteMany({ where: { userId, listingId } });
      if (result.count > 0) {
        await tx.listing.updateMany({
          where: { id: listingId, favoriteCount: { gt: 0 } },
          data: { favoriteCount: { decrement: 1 } },
        });
      }
      return { saved: false };
    });
  }
}
