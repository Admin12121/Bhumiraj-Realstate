import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@real-estate/database";
import {
  platformSettingsSchema,
  type CreateListingInput,
  type ListingFeedQuery,
} from "@real-estate/contracts";
import { ListingsRepository } from "./listings.repository";
import { apiEnv } from "../../bootstrap-env";

type ListingCardRow = Awaited<
  ReturnType<ListingsRepository["feed"]>
>[number];

@Injectable()
export class ListingsService {
  constructor(private readonly repository: ListingsRepository) {}

  async feed(query: ListingFeedQuery, userId?: string) {
    const rows = await this.repository.feed(query, userId);
    const hasMore = rows.length > query.limit;
    const visibleRows = rows.slice(0, query.limit);
    const items = visibleRows.map((row) => this.toCard(row));
    const last = visibleRows.at(-1);

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last ? this.repository.nextCursor(last, query.sort) : null,
    };
  }

  async detail(slug: string, userId?: string) {
    const row = await this.repository.detailBySlug(slug, userId);
    if (!row) throw new NotFoundException();

    const specification = row.property.specification;
    return {
      ...this.toCard({
        ...row,
        _count: { media: row.media.length },
        favoriteCount: row.favoriteCount,
        viewCount: row.viewCount,
      }),
      media: row.media.map((item) => ({
        id: item.mediaAsset.id,
        url: this.mediaUrl(
          item.mediaAsset.variants.find((variant) => variant.name === "large")
            ?.objectKey ?? item.mediaAsset.objectKey,
        )!,
        altText: item.altText,
        position: item.position,
      })),
      address: {
        province: row.property.address.province,
        district: row.property.address.district,
        municipality: row.property.address.municipality,
        ward: row.property.address.ward,
        locality: row.property.address.locality,
        street: row.property.address.street,
      },
      amenities: row.property.amenities.map(({ amenity }) => amenity),
      ownershipVerified: row.property.ownershipStatus === "VERIFIED",
      // Nullable throughout: the detail page omits a fact rather than
      // inventing one when the owner did not supply it.
      details: {
        kitchens: specification?.kitchens ?? null,
        floors: specification?.floors ?? null,
        builtYear: specification?.builtYear ?? null,
        furnishing: specification?.furnishing ?? null,
        facing: specification?.facing ?? null,
        roadAccessFeet:
          specification?.roadAccessFeet == null
            ? null
            : Number(specification.roadAccessFeet),
        landAreaAana:
          specification?.landAreaAana == null
            ? null
            : Number(specification.landAreaAana),
      },
    };
  }

  async create(userId: string, input: CreateListingInput) {
    const uniqueMediaIds = [...new Set(input.mediaAssetIds)];
    const uniqueAmenityIds = [...new Set(input.amenityIds)];
    if (uniqueMediaIds.length !== input.mediaAssetIds.length) {
      throw new ConflictException({
        code: "DUPLICATE_MEDIA",
        message: "A media asset can only be attached once.",
      });
    }

    const [user, assets, amenityCount, platformSetting, linkedMediaCount] =
      await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailVerified: true,
          banned: true,
          lifecycleStatus: true,
        },
      }),
      prisma.mediaAsset.findMany({
        where: {
          id: { in: uniqueMediaIds },
          ownerId: userId,
          status: "READY",
          purpose: { in: ["LISTING_IMAGE", "COVER_IMAGE"] },
          visibility: "PUBLIC",
        },
        select: { id: true },
      }),
      uniqueAmenityIds.length
        ? prisma.amenity.count({ where: { id: { in: uniqueAmenityIds } } })
        : Promise.resolve(0),
      prisma.systemSetting.findUnique({
        where: { key: "platform" },
        select: { value: true },
      }),
      prisma.listingMedia.count({
        where: { mediaAssetId: { in: uniqueMediaIds } },
      }),
    ]);

    if (!user || user.banned || user.lifecycleStatus !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Only active accounts can create property listings.",
      });
    }
    if (!user.emailVerified) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before posting a property.",
      });
    }
    const parsedSettings = platformSettingsSchema.safeParse(platformSetting?.value);
    const maximumPropertyImages = parsedSettings.success
      ? parsedSettings.data.maximumPropertyImages
      : 50;
    if (uniqueMediaIds.length > maximumPropertyImages) {
      throw new ConflictException({
        code: "TOO_MANY_PROPERTY_IMAGES",
        message: `A listing can contain at most ${maximumPropertyImages} property images.`,
      });
    }
    if (linkedMediaCount > 0) {
      throw new ConflictException({
        code: "MEDIA_ALREADY_ATTACHED",
        message: "One or more media assets are already attached to another listing.",
      });
    }

    if (assets.length !== uniqueMediaIds.length) {
      throw new ConflictException({
        code: "MEDIA_NOT_READY",
        message: "One or more property images are unavailable or still processing.",
      });
    }
    if (amenityCount !== uniqueAmenityIds.length) {
      throw new ConflictException({
        code: "INVALID_AMENITY",
        message: "One or more selected amenities do not exist.",
      });
    }

    const slugBase = input.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 120);
    const slug = `${slugBase || "property"}-${randomUUID().slice(0, 8)}`;
    const publicCoordinates = this.publicCoordinates(
      input.address.latitude,
      input.address.longitude,
      input.address.publicLocationPrecision,
    );

    if (input.listingType === "AUCTION" && input.auction) {
      const startsAt = new Date(input.auction.startsAt);
      const endsAt = new Date(input.auction.endsAt);
      const now = Date.now();
      if (endsAt.getTime() <= now + 5 * 60_000) {
        throw new ConflictException({
          code: "AUCTION_END_TOO_SOON",
          message: "The auction must end at least five minutes in the future.",
        });
      }
      if (startsAt.getTime() < now - 5 * 60_000) {
        throw new ConflictException({
          code: "AUCTION_START_IN_PAST",
          message: "The auction start time cannot be in the past.",
        });
      }
    }

    return prisma.$transaction(async (tx) => {
      const address = await tx.address.create({
        data: {
          province: input.address.province,
          district: input.address.district,
          municipality: input.address.municipality,
          ward: input.address.ward ?? null,
          locality: input.address.locality,
          street: input.address.street ?? null,
          latitude: input.address.latitude ?? null,
          longitude: input.address.longitude ?? null,
          publicLatitude: publicCoordinates.latitude,
          publicLongitude: publicCoordinates.longitude,
          precision: input.address.publicLocationPrecision,
        },
      });

      const property = await tx.property.create({
        data: {
          ownerId: userId,
          addressId: address.id,
          type: input.propertyType,
          specification: {
            create: {
              bedrooms: input.specifications.bedrooms ?? null,
              bathrooms: input.specifications.bathrooms ?? null,
              kitchens: input.specifications.kitchens ?? null,
              parkingSpaces: input.specifications.parkingSpaces ?? null,
              floors: input.specifications.floors ?? null,
              builtYear: input.specifications.builtYear ?? null,
              furnishing: input.specifications.furnishing ?? null,
              areaSqFt: input.specifications.areaSqFt,
            },
          },
          amenities: {
            create: uniqueAmenityIds.map((amenityId) => ({ amenityId })),
          },
        },
      });

      const listing = await tx.listing.create({
        data: {
          propertyId: property.id,
          createdById: userId,
          slug,
          title: input.title,
          description: input.description,
          type: input.listingType,
          currency:
            input.price?.currency ??
            (input.listingType === "AUCTION" ? "NPR" : "NPR"),
          priceMinor: input.price ? BigInt(input.price.amountMinor) : null,
          rentPeriod: input.rentPeriod,
          media: {
            create: uniqueMediaIds.map((mediaAssetId, position) => ({
              mediaAssetId,
              position,
            })),
          },
          statusHistory: {
            create: { toStatus: "DRAFT", actorId: userId },
          },
        },
        select: { id: true, slug: true, status: true },
      });

      if (input.listingType === "AUCTION" && input.auction) {
        const startsAt = new Date(input.auction.startsAt);
        const endsAt = new Date(input.auction.endsAt);
        const maximumExtendedUntil = new Date(
          endsAt.getTime() + input.auction.maximumExtensionMinutes * 60_000,
        );
        const auction = await tx.auction.create({
          data: {
            listingId: listing.id,
            status: "DRAFT",
            currency: "NPR",
            startingAmountMinor: BigInt(input.auction.startingAmountMinor),
            reserveAmountMinor: input.auction.reserveAmountMinor
              ? BigInt(input.auction.reserveAmountMinor)
              : null,
            currentAmountMinor: BigInt(input.auction.startingAmountMinor),
            minimumIncrementMinor: BigInt(
              input.auction.minimumIncrementMinor,
            ),
            startsAt,
            originalEndsAt: endsAt,
            endsAt,
            maximumExtendedUntil,
            extensionWindowSeconds: input.auction.extensionWindowSeconds,
            extensionDurationSeconds: input.auction.extensionDurationSeconds,
            statusHistory: { create: { toStatus: "DRAFT", actorId: userId } },
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: "AUCTION_CREATED",
            entityType: "Auction",
            entityId: auction.id,
            after: {
              listingId: listing.id,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "LISTING_CREATED",
          entityType: "Listing",
          entityId: listing.id,
          after: { title: input.title, type: input.listingType },
        },
      });
      return listing;
    });
  }

  async recordView(
    listingId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string | string[],
  ) {
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!listing) throw new NotFoundException();

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const visitorHash = userId
      ? null
      : createHash("sha256")
          .update(
            `${ipAddress ?? "unknown"}|${Array.isArray(userAgent) ? userAgent.join(" ") : userAgent ?? "unknown"}|${startOfDay.toISOString()}|${apiEnv.VIEW_HASH_SECRET}`,
          )
          .digest("hex");

    const viewerKey = userId ? `user:${userId}` : `visitor:${visitorHash}`;
    const counted = await prisma.$transaction(async (tx) => {
      const inserted = await tx.listingView.createMany({
        data: [
          {
            listingId,
            userId: userId ?? null,
            visitorHash,
            viewerKey,
            viewDate: startOfDay,
          },
        ],
        skipDuplicates: true,
      });
      if (inserted.count === 0) return false;

      await tx.listing.update({
        where: { id: listingId },
        data: { viewCount: { increment: 1 } },
      });
      return true;
    });
    return { counted };
  }

  async submit(id: string, userId: string) {
    const row = await this.repository.findOwned(id);
    if (!row || row.createdById !== userId) throw new NotFoundException();
    if (row.status !== "DRAFT" && row.status !== "REJECTED") {
      throw new ConflictException({
        code: "INVALID_LISTING_STATE",
        message: "Only draft or rejected listings can be submitted.",
      });
    }
    if (row.type === "AUCTION") {
      if (!row.auction) {
        throw new ConflictException({
          code: "AUCTION_CONFIGURATION_MISSING",
          message: "Auction settings are missing.",
        });
      }
      if (row.auction.endsAt <= new Date()) {
        throw new ConflictException({
          code: "AUCTION_ENDED_BEFORE_REVIEW",
          message: "Update the auction schedule before submitting the listing.",
        });
      }
    }

    return prisma.$transaction(async (tx) => {
      const listing = await tx.listing.update({
        where: { id },
        data: { status: "PENDING_REVIEW", version: { increment: 1 } },
        // Only what the caller needs. Returning the whole row leaked a BigInt
        // price, which Express cannot serialise — the request 500'd after the
        // listing had already been submitted.
        select: { id: true, slug: true, status: true },
      });
      await tx.listingStatusHistory.create({
        data: {
          listingId: id,
          fromStatus: row.status,
          toStatus: "PENDING_REVIEW",
          actorId: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "LISTING_SUBMITTED",
          entityType: "Listing",
          entityId: id,
        },
      });
      return listing;
    });
  }

  private toCard(row: ListingCardRow) {
    const assigned = row.assignments?.[0];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      listingType: row.type,
      propertyType: row.property.type,
      status: row.status,
      price:
        row.priceMinor === null
          ? null
          : {
              amountMinor: row.priceMinor.toString(),
              currency: row.currency,
            },
      rentPeriod: row.rentPeriod ?? null,
      location: {
        locality: row.property.address.locality,
        district: row.property.address.district,
        latitude:
          row.property.address.publicLatitude === null
            ? null
            : Number(row.property.address.publicLatitude),
        longitude:
          row.property.address.publicLongitude === null
            ? null
            : Number(row.property.address.publicLongitude),
      },
      specifications: {
        bedrooms: row.property.specification?.bedrooms ?? null,
        bathrooms: row.property.specification?.bathrooms ?? null,
        areaSqFt: row.property.specification?.areaSqFt
          ? Number(row.property.specification.areaSqFt)
          : null,
        parkingSpaces: row.property.specification?.parkingSpaces ?? null,
      },
      coverImageUrl: this.mediaUrl(
        row.media[0]?.mediaAsset.variants[0]?.objectKey ??
          row.media[0]?.mediaAsset.objectKey,
      ),
      imageCount: row._count?.media ?? row.media.length,
      favoriteCount: row.favoriteCount,
      viewCount: row.viewCount.toString(),
      isVerified: row.isVerified,
      isSaved: Array.isArray(row.favorites) && row.favorites.length > 0,
      // Null until an agent accepts the offer: an unrepresented listing has
      // nobody to contact, and naming the submitter would be misleading.
      agent: assigned
        ? {
            id: assigned.agent.user.id,
            username: assigned.agent.user.profile?.username ?? null,
            name: assigned.agent.user.name,
            image: assigned.agent.user.image,
            verified: assigned.agent.verifiedAt !== null,
          }
        : null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      auction: row.auction
        ? {
            id: row.auction.id,
            status: row.auction.status,
            currentAmountMinor: row.auction.currentAmountMinor.toString(),
            bidCount: row.auction.bidCount,
            endsAt: row.auction.endsAt.toISOString(),
          }
        : null,
    };
  }

  private publicCoordinates(
    latitude: number | undefined,
    longitude: number | undefined,
    precision: "EXACT" | "APPROXIMATE" | "LOCALITY",
  ) {
    if (latitude === undefined || longitude === undefined || precision === "LOCALITY") {
      return { latitude: null, longitude: null };
    }
    if (precision === "EXACT") return { latitude, longitude };
    return {
      latitude: Math.round(latitude * 100) / 100,
      longitude: Math.round(longitude * 100) / 100,
    };
  }

  private mediaUrl(key?: string | null) {
    if (!key) return null;
    return `${apiEnv.CDN_BASE_URL.replace(/\/$/, "")}/${key}`;
  }
}
