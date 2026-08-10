import { Injectable } from "@nestjs/common";
import { prisma } from "@real-estate/database";
import { idSchema, type ListingFeedQuery } from "@real-estate/contracts";
import { z } from "zod";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";

const newestCursorSchema = z
  .object({ publishedAt: z.iso.datetime({ offset: true }), id: idSchema })
  .strict();
const priceCursorSchema = z
  .object({ priceMinor: z.string().regex(/^\d{1,19}$/), id: idSchema })
  .strict();
const popularCursorSchema = z
  .object({
    favoriteCount: z.number().int().nonnegative(),
    viewCount: z.string().regex(/^\d{1,19}$/),
    publishedAt: z.iso.datetime({ offset: true }),
    id: idSchema,
  })
  .strict();

@Injectable()
export class ListingsRepository {
  async feed(query: ListingFeedQuery, userId?: string) {
    const conditions: object[] = [{ status: "PUBLISHED" }];

    if (query.type) conditions.push({ type: query.type });
    if (query.agentId) conditions.push({ createdById: query.agentId });
    if (query.propertyType || query.district || query.bedrooms !== undefined) {
      conditions.push({
        property: {
          ...(query.propertyType ? { type: query.propertyType } : {}),
          ...(query.district
            ? {
                address: {
                  district: { equals: query.district, mode: "insensitive" },
                },
              }
            : {}),
          ...(query.bedrooms !== undefined
            ? { specification: { bedrooms: { gte: query.bedrooms } } }
            : {}),
        },
      });
    }
    if (query.q) {
      conditions.push({
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { description: { contains: query.q, mode: "insensitive" } },
          {
            property: {
              address: {
                OR: [
                  { locality: { contains: query.q, mode: "insensitive" } },
                  { district: { contains: query.q, mode: "insensitive" } },
                  { municipality: { contains: query.q, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      });
    }
    if (
      query.minPriceMinor !== undefined ||
      query.maxPriceMinor !== undefined
    ) {
      conditions.push({
        priceMinor: {
          ...(query.minPriceMinor !== undefined
            ? { gte: query.minPriceMinor }
            : {}),
          ...(query.maxPriceMinor !== undefined
            ? { lte: query.maxPriceMinor }
            : {}),
        },
      });
    }

    const cursorCondition = this.cursorCondition(query);
    if (cursorCondition) conditions.push(cursorCondition);
    if (query.sort === "price-asc" || query.sort === "price-desc") {
      conditions.push({ priceMinor: { not: null } });
    }

    return prisma.listing.findMany({
      where: { AND: conditions },
      take: query.limit + 1,
      orderBy: this.orderBy(query.sort),
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        type: true,
        status: true,
        currency: true,
        priceMinor: true,
        rentPeriod: true,
        isVerified: true,
        publishedAt: true,
        createdAt: true,
        favoriteCount: true,
        viewCount: true,
        property: {
          select: {
            type: true,
            address: {
              select: {
                locality: true,
                district: true,
                publicLatitude: true,
                publicLongitude: true,
              },
            },
            specification: {
              select: {
                bedrooms: true,
                bathrooms: true,
                areaSqFt: true,
                parkingSpaces: true,
              },
            },
          },
        },
        media: {
          take: 1,
          orderBy: { position: "asc" },
          select: {
            mediaAsset: {
              select: {
                objectKey: true,
                variants: {
                  take: 1,
                  where: { name: "card" },
                  select: { objectKey: true },
                },
              },
            },
          },
        },
        _count: { select: { media: true } },
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true,
            agentProfile: { select: { verifiedAt: true } },
          },
        },
        favorites: userId
          ? { where: { userId }, select: { userId: true } }
          : false,
        auction: {
          select: {
            id: true,
            status: true,
            currentAmountMinor: true,
            bidCount: true,
            endsAt: true,
          },
        },
      },
    });
  }

  nextCursor(
    row: {
      id: string;
      publishedAt: Date | null;
      priceMinor: bigint | null;
      favoriteCount: number;
      viewCount: bigint;
    },
    sort: ListingFeedQuery["sort"],
  ): string | null {
    if (sort === "price-asc" || sort === "price-desc") {
      return row.priceMinor === null
        ? null
        : encodeCursor({ priceMinor: row.priceMinor.toString(), id: row.id });
    }
    if (!row.publishedAt) return null;
    if (sort === "popular") {
      return encodeCursor({
        favoriteCount: row.favoriteCount,
        viewCount: row.viewCount.toString(),
        publishedAt: row.publishedAt.toISOString(),
        id: row.id,
      });
    }
    return encodeCursor({
      publishedAt: row.publishedAt.toISOString(),
      id: row.id,
    });
  }

  detailBySlug(slug: string, userId?: string) {
    return prisma.listing.findFirst({
      where: {
        slug,
        OR: [
          { status: "PUBLISHED" },
          ...(userId ? [{ createdById: userId }] : []),
        ],
      },
      include: {
        property: {
          include: {
            address: true,
            specification: true,
            amenities: { include: { amenity: true } },
          },
        },
        media: {
          orderBy: { position: "asc" },
          include: { mediaAsset: { include: { variants: true } } },
        },
        createdBy: {
          select: { id: true, name: true, image: true, agentProfile: true },
        },
        auction: true,
        favorites: userId
          ? { where: { userId }, select: { userId: true } }
          : false,
      },
    });
  }

  findOwned(id: string) {
    return prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        propertyId: true,
        type: true,
        auction: { select: { id: true, startsAt: true, endsAt: true } },
      },
    });
  }

  private orderBy(sort: ListingFeedQuery["sort"]) {
    if (sort === "price-asc") {
      return [{ priceMinor: "asc" as const }, { id: "asc" as const }];
    }
    if (sort === "price-desc") {
      return [{ priceMinor: "desc" as const }, { id: "desc" as const }];
    }
    if (sort === "popular") {
      return [
        { favoriteCount: "desc" as const },
        { viewCount: "desc" as const },
        { publishedAt: "desc" as const },
        { id: "desc" as const },
      ];
    }
    return [
      { publishedAt: "desc" as const },
      { id: "desc" as const },
    ];
  }

  private cursorCondition(query: ListingFeedQuery): object | undefined {
    if (!query.cursor) return undefined;

    if (query.sort === "price-asc" || query.sort === "price-desc") {
      const cursor = decodeCursor(query.cursor, priceCursorSchema);
      if (!cursor) return undefined;
      const priceMinor = BigInt(cursor.priceMinor);
      const comparison = query.sort === "price-asc" ? "gt" : "lt";
      return {
        OR: [
          { priceMinor: { [comparison]: priceMinor } },
          { priceMinor, id: { [comparison]: cursor.id } },
        ],
      };
    }

    if (query.sort === "popular") {
      const cursor = decodeCursor(query.cursor, popularCursorSchema);
      if (!cursor) return undefined;
      const publishedAt = new Date(cursor.publishedAt);
      const viewCount = BigInt(cursor.viewCount);
      return {
        OR: [
          { favoriteCount: { lt: cursor.favoriteCount } },
          { favoriteCount: cursor.favoriteCount, viewCount: { lt: viewCount } },
          {
            favoriteCount: cursor.favoriteCount,
            viewCount,
            publishedAt: { lt: publishedAt },
          },
          {
            favoriteCount: cursor.favoriteCount,
            viewCount,
            publishedAt,
            id: { lt: cursor.id },
          },
        ],
      };
    }

    const cursor = decodeCursor(query.cursor, newestCursorSchema);
    if (!cursor) return undefined;
    const publishedAt = new Date(cursor.publishedAt);
    return {
      OR: [
        { publishedAt: { lt: publishedAt } },
        { publishedAt, id: { lt: cursor.id } },
      ],
    };
  }
}
