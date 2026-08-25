import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  adminListingsQuerySchema,
  idSchema,
  listingModerationDecisionSchema,
  updateAdminListingSchema,
} from "@real-estate/contracts";
import { prisma, type Prisma } from "@real-estate/database";
import { randomUUID } from "node:crypto";
import { StaffPermissions } from "../../shared/auth/staff-permissions.decorator";
import { StaffPermissionsGuard } from "../../shared/auth/staff-permissions.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ADMIN_PERMISSIONS } from "./admin.permissions";
import { apiEnv } from "../../bootstrap-env";

/**
 * Prisma returns `Decimal` columns as strings. The contract — and the form
 * bound to it — want numbers, so every decimal crosses the boundary here.
 */
function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Only the keys that actually moved, so the audit entry is the diff. */
function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const from: Record<string, unknown> = {};
  const to: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    if (before[key] === value) continue;
    from[key] = before[key] ?? null;
    to[key] = value;
  }
  return { before: from, after: to };
}

@Controller("api/v1/admin/listings")
@UseGuards(StaffPermissionsGuard)
export class AdminListingsController {
  @Get()
  @StaffPermissions(ADMIN_PERMISSIONS.LISTINGS_READ)
  async list(
    @Query(new ZodValidationPipe(adminListingsQuerySchema))
    query: z.infer<typeof adminListingsQuerySchema>,
  ) {
    const where: Prisma.ListingWhereInput = {
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" as const } },
              { slug: { contains: query.search, mode: "insensitive" as const } },
              {
                createdBy: {
                  email: { contains: query.search, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const orderBy =
      query.sort === "title"
        ? { title: query.direction }
        : query.sort === "status"
          ? { status: query.direction }
          : { createdAt: query.direction };

    const [rows, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          type: true,
          priceMinor: true,
          currency: true,
          createdAt: true,
          publishedAt: true,
          property: { select: { type: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        type: row.type,
        propertyType: row.property.type,
        owner: row.createdBy,
        priceMinor: row.priceMinor?.toString() ?? null,
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
        publishedAt: row.publishedAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  @Post(":id/decision")
  @StaffPermissions(ADMIN_PERMISSIONS.LISTINGS_MODERATE)
  async decide(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(listingModerationDecisionSchema))
    body: { decision: "PUBLISH" | "REJECT"; reason?: string },
    @Session() session: UserSession,
  ) {
    return prisma.$transaction(async (tx) => {
      const row = await tx.listing.findUnique({
        where: { id },
        include: { auction: true },
      });
      if (!row) throw new ConflictException({ code: "LISTING_NOT_FOUND", message: "Listing not found." });
      if (!["PENDING_REVIEW", "REJECTED"].includes(row.status)) {
        throw new ConflictException({
          code: "INVALID_LISTING_STATE",
          message: "Only pending or rejected listings can receive this decision.",
        });
      }
      if (body.decision === "REJECT" && !body.reason) {
        throw new ConflictException({
          code: "REJECTION_REASON_REQUIRED",
          message: "A rejection reason is required.",
        });
      }

      const nowRows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
      const now = nowRows[0]?.now ?? new Date();
      /**
       * A seller's property goes live under an agent, so approving it hands it
       * to the assignment queue rather than publishing it directly — otherwise
       * the listing appears with no agent behind it and no way to reach one.
       * Auctions are run by the platform itself and need no agent.
       */
      const status =
        body.decision !== "PUBLISH"
          ? "REJECTED"
          : row.type === "AUCTION"
            ? "PUBLISHED"
            : "AWAITING_AGENT";

      if (status === "PUBLISHED" && row.type === "AUCTION") {
        if (!row.auction || row.auction.endsAt <= now) {
          throw new ConflictException({
            code: "INVALID_AUCTION_SCHEDULE",
            message: "The auction schedule must be updated before publication.",
          });
        }
        const auctionStatus = row.auction.startsAt <= now ? "LIVE" : "SCHEDULED";
        const eventSequence = row.auction.eventSequence + 1;
        await tx.auction.update({
          where: { id: row.auction.id },
          data: {
            status: auctionStatus,
            eventSequence,
            version: { increment: 1 },
          },
        });
        await tx.auctionStatusHistory.create({
          data: {
            auctionId: row.auction.id,
            fromStatus: row.auction.status,
            toStatus: auctionStatus,
            actorId: session.user.id,
            reason: "Listing approved for publication.",
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: "Auction",
            aggregateId: row.auction.id,
            eventType: "auction.status.changed",
            payload: {
              type: "auction.status.changed",
              eventId: randomUUID(),
              auctionId: row.auction.id,
              sequence: eventSequence,
              serverTime: now.toISOString(),
              data: { status: auctionStatus },
            },
          },
        });
      }

      const listing = await tx.listing.update({
        where: { id },
        data: {
          status,
          publishedAt: status === "PUBLISHED" ? now : row.publishedAt,
          isVerified: status === "PUBLISHED",
          version: { increment: 1 },
        },
      });
      await tx.listingStatusHistory.create({
        data: {
          listingId: id,
          fromStatus: row.status,
          toStatus: status,
          reason: body.reason ?? null,
          actorId: session.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action:
            status === "PUBLISHED" ? "LISTING_PUBLISHED" : "LISTING_REJECTED",
          entityType: "Listing",
          entityId: id,
          reason: body.reason ?? null,
        },
      });
      return { id: listing.id, status: listing.status };
    });
  }

  @Get(":slug")
  @StaffPermissions(ADMIN_PERMISSIONS.LISTINGS_READ)
  async detail(@Param("slug") slug: string) {
    const row = await prisma.listing.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        type: true,
        priceMinor: true,
        currency: true,
        rentPeriod: true,
        isVerified: true,
        createdAt: true,
        publishedAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignments: {
          where: { status: "ACCEPTED" },
          take: 1,
          select: {
            agent: {
              select: { user: { select: { id: true, name: true } } },
            },
          },
        },
        property: {
          select: {
            type: true,
            address: true,
            specification: true,
          },
        },
        media: {
          orderBy: { position: "asc" },
          select: {
            mediaAsset: {
              select: {
                id: true,
                objectKey: true,
                variants: { select: { name: true, objectKey: true } },
              },
            },
          },
        },
        paymentProofs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            method: true,
            reference: true,
            amountMinor: true,
            currency: true,
            mediaAssetId: true,
            rejectionReason: true,
            createdAt: true,
            reviewedAt: true,
            submittedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
        },
        auction: {
          select: {
            id: true,
            status: true,
            startingAmountMinor: true,
            currentAmountMinor: true,
            depositAmountMinor: true,
            bidCount: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      });
    }

    const base = apiEnv.CDN_BASE_URL.replace(/\/$/, "");
    const address = row.property.address;
    const specification = row.property.specification;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status,
      type: row.type,
      propertyType: row.property.type,
      priceMinor: row.priceMinor?.toString() ?? null,
      currency: row.currency,
      rentPeriod: row.rentPeriod,
      isVerified: row.isVerified,
      createdAt: row.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      owner: row.createdBy,
      agent: row.assignments[0]?.agent.user ?? null,
      address: {
        province: address?.province ?? "",
        district: address?.district ?? "",
        municipality: address?.municipality ?? "",
        ward: address?.ward ?? null,
        locality: address?.locality ?? "",
        street: address?.street ?? null,
        latitude: decimalToNumber(address?.latitude),
        longitude: decimalToNumber(address?.longitude),
      },
      specifications: {
        bedrooms: specification?.bedrooms ?? null,
        bathrooms: specification?.bathrooms ?? null,
        kitchens: specification?.kitchens ?? null,
        floors: specification?.floors ?? null,
        parkingSpaces: specification?.parkingSpaces ?? null,
        areaSqFt: decimalToNumber(specification?.areaSqFt),
        builtYear: specification?.builtYear ?? null,
        furnishing: specification?.furnishing ?? null,
      },
      images: row.media.map((entry) => ({
        id: entry.mediaAsset.id,
        url: `${base}/${
          entry.mediaAsset.variants.find((v) => v.name === "card")?.objectKey ??
          entry.mediaAsset.variants[0]?.objectKey ??
          entry.mediaAsset.objectKey
        }`,
      })),
      payment: row.paymentProofs[0]
        ? {
            id: row.paymentProofs[0].id,
            status: row.paymentProofs[0].status,
            method: row.paymentProofs[0].method,
            reference: row.paymentProofs[0].reference,
            amountMinor: row.paymentProofs[0].amountMinor.toString(),
            currency: row.paymentProofs[0].currency,
            mediaAssetId: row.paymentProofs[0].mediaAssetId,
            rejectionReason: row.paymentProofs[0].rejectionReason,
            submittedAt: row.paymentProofs[0].createdAt.toISOString(),
            reviewedAt: row.paymentProofs[0].reviewedAt?.toISOString() ?? null,
            submittedBy: row.paymentProofs[0].submittedBy,
            reviewedBy: row.paymentProofs[0].reviewedBy,
          }
        : null,
      auction: row.auction
        ? {
            id: row.auction.id,
            status: row.auction.status,
            startingAmountMinor: row.auction.startingAmountMinor.toString(),
            currentAmountMinor: row.auction.currentAmountMinor.toString(),
            depositAmountMinor:
              row.auction.depositAmountMinor?.toString() ?? null,
            bidCount: row.auction.bidCount,
            startsAt: row.auction.startsAt.toISOString(),
            endsAt: row.auction.endsAt.toISOString(),
          }
        : null,
    };
  }

  @Get(":slug/changes")
  @StaffPermissions(ADMIN_PERMISSIONS.LISTINGS_READ)
  async changes(@Param("slug") slug: string) {
    const listing = await prisma.listing.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException({
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      });
    }
    const rows = await prisma.auditLog.findMany({
      where: { entityType: "Listing", entityId: listing.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        before: true,
        after: true,
        reason: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actor: row.actor,
        before: row.before as Record<string, unknown> | null,
        after: row.after as Record<string, unknown> | null,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Staff edits, recorded as a diff. Status is not editable here: it moves
   * through the moderation decision endpoint, which writes status history.
   */
  @Patch(":slug")
  @StaffPermissions(ADMIN_PERMISSIONS.LISTINGS_MODERATE)
  async update(
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(updateAdminListingSchema))
    body: z.infer<typeof updateAdminListingSchema>,
    @Session() session: UserSession,
  ) {
    return prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({
        where: { slug },
        select: {
          id: true,
          title: true,
          description: true,
          priceMinor: true,
          rentPeriod: true,
          isVerified: true,
          propertyId: true,
          property: {
            select: { type: true, address: true, specification: true },
          },
          auction: { select: { id: true } },
        },
      });
      if (!listing) {
        throw new NotFoundException({
          code: "LISTING_NOT_FOUND",
          message: "Listing not found.",
        });
      }

      const listingChanges = changedFields(
        {
          title: listing.title,
          description: listing.description,
          priceMinor: listing.priceMinor?.toString() ?? null,
          rentPeriod: listing.rentPeriod,
          isVerified: listing.isVerified,
        },
        {
          ...(body.title === undefined ? {} : { title: body.title }),
          ...(body.description === undefined
            ? {}
            : { description: body.description }),
          ...(body.priceMinor === undefined
            ? {}
            : { priceMinor: body.priceMinor }),
          ...(body.rentPeriod === undefined
            ? {}
            : { rentPeriod: body.rentPeriod }),
          ...(body.isVerified === undefined
            ? {}
            : { isVerified: body.isVerified }),
        },
      );

      if (Object.keys(listingChanges.after).length > 0) {
        await tx.listing.update({
          where: { id: listing.id },
          data: {
            ...(body.title === undefined ? {} : { title: body.title }),
            ...(body.description === undefined
              ? {}
              : { description: body.description }),
            ...(body.priceMinor === undefined
              ? {}
              : { priceMinor: body.priceMinor ? BigInt(body.priceMinor) : null }),
            ...(body.rentPeriod === undefined
              ? {}
              : { rentPeriod: body.rentPeriod }),
            ...(body.isVerified === undefined
              ? {}
              : { isVerified: body.isVerified }),
            version: { increment: 1 },
          },
        });
      }

      const before: Record<string, unknown> = { ...listingChanges.before };
      const after: Record<string, unknown> = { ...listingChanges.after };

      if (body.propertyType && body.propertyType !== listing.property.type) {
        before.propertyType = listing.property.type;
        after.propertyType = body.propertyType;
        await tx.property.update({
          where: { id: listing.propertyId },
          data: { type: body.propertyType },
        });
      }

      if (body.address && listing.property.address) {
        const diff = changedFields(
          listing.property.address as unknown as Record<string, unknown>,
          body.address as Record<string, unknown>,
        );
        if (Object.keys(diff.after).length > 0) {
          Object.assign(before, diff.before);
          Object.assign(after, diff.after);
          await tx.address.update({
            where: { id: listing.property.address.id },
            data: { ...body.address } as Prisma.AddressUpdateInput,
          });
        }
      }

      if (body.specifications && listing.property.specification) {
        const diff = changedFields(
          listing.property.specification as unknown as Record<string, unknown>,
          body.specifications as Record<string, unknown>,
        );
        if (Object.keys(diff.after).length > 0) {
          Object.assign(before, diff.before);
          Object.assign(after, diff.after);
          await tx.propertySpecification.update({
            where: { id: listing.property.specification.id },
            data: {
              ...body.specifications,
            } as Prisma.PropertySpecificationUpdateInput,
          });
        }
      }

      if (body.auction && listing.auction) {
        await tx.auction.update({
          where: { id: listing.auction.id },
          data: {
            ...(body.auction.startingAmountMinor === undefined
              ? {}
              : {
                  startingAmountMinor: BigInt(body.auction.startingAmountMinor),
                }),
            ...(body.auction.minimumIncrementMinor === undefined
              ? {}
              : {
                  minimumIncrementMinor: BigInt(
                    body.auction.minimumIncrementMinor,
                  ),
                }),
            ...(body.auction.reserveAmountMinor === undefined
              ? {}
              : {
                  reserveAmountMinor: body.auction.reserveAmountMinor
                    ? BigInt(body.auction.reserveAmountMinor)
                    : null,
                }),
            ...(body.auction.depositAmountMinor === undefined
              ? {}
              : {
                  depositAmountMinor: body.auction.depositAmountMinor
                    ? BigInt(body.auction.depositAmountMinor)
                    : null,
                }),
            ...(body.auction.startsAt === undefined
              ? {}
              : { startsAt: new Date(body.auction.startsAt) }),
            ...(body.auction.endsAt === undefined
              ? {}
              : { endsAt: new Date(body.auction.endsAt) }),
            version: { increment: 1 },
          },
        });
        after.auction = body.auction;
      }

      if (Object.keys(after).length === 0) {
        return { id: listing.id, changed: false };
      }

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "LISTING_UPDATED",
          entityType: "Listing",
          entityId: listing.id,
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
        },
      });

      return { id: listing.id, changed: true };
    });
  }
}
