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
  adminAuctionActionSchema,
  adminAuctionsQuerySchema,
  idSchema,
} from "@real-estate/contracts";
import { prisma, type Prisma } from "@real-estate/database";
import { randomUUID } from "node:crypto";
import {
  StaffPermissions,
  StrongAuth,
} from "../../shared/auth/staff-permissions.decorator";
import { StaffPermissionsGuard } from "../../shared/auth/staff-permissions.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ADMIN_PERMISSIONS } from "./admin.permissions";

@Controller("api/v1/admin/auctions")
@UseGuards(StaffPermissionsGuard)
export class AdminAuctionsController {
  @Get()
  @StaffPermissions(ADMIN_PERMISSIONS.AUCTIONS_READ)
  async list(
    @Query(new ZodValidationPipe(adminAuctionsQuerySchema))
    query: z.infer<typeof adminAuctionsQuerySchema>,
  ) {
    const where: Prisma.AuctionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            listing: {
              title: { contains: query.search, mode: "insensitive" as const },
            },
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.auction.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.direction },
        include: { listing: { select: { title: true } } },
      }),
      prisma.auction.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        listingId: row.listingId,
        title: row.listing.title,
        status: row.status,
        currency: row.currency,
        currentAmountMinor: row.currentAmountMinor.toString(),
        bidCount: row.bidCount,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  @Post(":id/action")
  @StaffPermissions(ADMIN_PERMISSIONS.AUCTIONS_MANAGE)
  @StrongAuth()
  async action(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(adminAuctionActionSchema))
    body: { action: "PAUSE" | "RESUME" | "CANCEL"; reason?: string },
    @Session() session: UserSession,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${id} FOR UPDATE`;
      const auction = await tx.auction.findUnique({ where: { id } });
      if (!auction) throw new ConflictException({ code: "AUCTION_NOT_FOUND", message: "Auction not found." });
      const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
      const now = clock?.now ?? new Date();

      let nextStatus: "PAUSED" | "LIVE" | "CANCELLED";
      if (body.action === "PAUSE") {
        if (auction.status !== "LIVE") throw this.invalidTransition();
        nextStatus = "PAUSED";
      } else if (body.action === "RESUME") {
        if (auction.status !== "PAUSED" || auction.endsAt <= now) throw this.invalidTransition();
        nextStatus = "LIVE";
      } else {
        if (!["DRAFT", "SCHEDULED", "LIVE", "PAUSED"].includes(auction.status)) {
          throw this.invalidTransition();
        }
        nextStatus = "CANCELLED";
      }

      const eventSequence = auction.eventSequence + 1;
      await tx.auction.update({
        where: { id },
        data: {
          status: nextStatus,
          eventSequence,
          version: { increment: 1 },
        },
      });
      await tx.auctionStatusHistory.create({
        data: {
          auctionId: id,
          fromStatus: auction.status,
          toStatus: nextStatus,
          reason: body.reason ?? null,
          actorId: session.user.id,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "Auction",
          aggregateId: id,
          eventType: "auction.status.changed",
          payload: {
            type: "auction.status.changed",
            eventId: randomUUID(),
            auctionId: id,
            sequence: eventSequence,
            serverTime: now.toISOString(),
            data: { status: nextStatus },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action:
            nextStatus === "PAUSED"
              ? "AUCTION_PAUSED"
              : nextStatus === "LIVE"
                ? "AUCTION_RESUMED"
                : "AUCTION_CANCELLED",
          entityType: "Auction",
          entityId: id,
          reason: body.reason ?? null,
          before: { status: auction.status },
          after: { status: nextStatus, eventSequence },
        },
      });
      return { id, status: nextStatus };
    });
  }

  private invalidTransition() {
    return new ConflictException({
      code: "INVALID_AUCTION_TRANSITION",
      message: "The requested auction transition is not allowed.",
    });
  }
}
