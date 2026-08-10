import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
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
} from "@real-estate/contracts";
import { prisma, type Prisma } from "@real-estate/database";
import { randomUUID } from "node:crypto";
import { Roles } from "../../shared/auth/roles.decorator";
import { RolesGuard } from "../../shared/auth/roles.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";

@Controller("api/v1/admin/listings")
@UseGuards(RolesGuard)
@Roles("MODERATOR", "ADMIN", "SUPER_ADMIN")
export class AdminListingsController {
  @Get()
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
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.type ? { type: query.type as any } : {}),
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
      const status = body.decision === "PUBLISH" ? "PUBLISHED" : "REJECTED";

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
}
