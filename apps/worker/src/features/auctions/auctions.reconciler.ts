import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { prisma } from "@real-estate/database";

@Injectable()
export class AuctionsReconciler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuctionsReconciler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  onModuleInit() {
    this.timer = setInterval(() => void this.reconcile(), 1_000);
    this.timer.unref();
    void this.reconcile();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async reconcile() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const [due, scheduled] = await Promise.all([
        prisma.auction.findMany({
          where: { status: "LIVE", endsAt: { lte: now } },
          orderBy: { endsAt: "asc" },
          take: 50,
          select: { id: true },
        }),
        prisma.auction.findMany({
          where: { status: "SCHEDULED", startsAt: { lte: now } },
          orderBy: { startsAt: "asc" },
          take: 50,
          select: { id: true },
        }),
      ]);

      for (const { id } of due) {
        await this.runSafely("close", id, () => this.close(id));
      }
      for (const { id } of scheduled) {
        await this.runSafely("start", id, () => this.start(id));
      }
    } catch (error) {
      this.logger.error(error);
    } finally {
      this.running = false;
    }
  }

  private async runSafely(action: string, id: string, work: () => Promise<void>) {
    try {
      await work();
    } catch (error) {
      this.logger.error(`Auction ${action} failed for ${id}`, error);
    }
  }

  private async start(id: string) {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${id} FOR UPDATE`;
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`
          SELECT NOW() AS now
        `;
        const now = clock?.now ?? new Date();
        const auction = await tx.auction.findUnique({ where: { id } });
        if (!auction || auction.status !== "SCHEDULED" || auction.startsAt > now) {
          return;
        }

        const status = auction.endsAt <= now ? "ENDED" : "LIVE";
        const eventSequence = auction.eventSequence + 1;
        const reason =
          status === "ENDED"
            ? "Auction schedule elapsed before startup."
            : null;

        await tx.auction.update({
          where: { id },
          data: {
            status,
            eventSequence,
            version: { increment: 1 },
          },
        });
        await tx.auctionStatusHistory.create({
          data: {
            auctionId: id,
            fromStatus: "SCHEDULED",
            toStatus: status,
            reason,
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
              data: { status },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            action: status === "LIVE" ? "AUCTION_STARTED" : "AUCTION_ENDED",
            entityType: "Auction",
            entityId: id,
            reason,
            after: { status, eventSequence },
          },
        });
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
    );
  }

  private async close(id: string) {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${id} FOR UPDATE`;
        const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`
          SELECT NOW() AS now
        `;
        const now = clock?.now ?? new Date();
        const auction = await tx.auction.findUnique({
          where: { id },
          include: { listing: { select: { property: { select: { ownerId: true } } } } },
        });
        if (!auction || auction.status !== "LIVE" || auction.endsAt > now) return;

        const reserveMet =
          auction.reserveAmountMinor === null ||
          auction.currentAmountMinor >= auction.reserveAmountMinor;
        const status =
          reserveMet && auction.currentBidId ? "AWAITING_SETTLEMENT" : "ENDED";
        const eventSequence = auction.eventSequence + 1;

        await tx.auction.update({
          where: { id },
          data: {
            status,
            eventSequence,
            version: { increment: 1 },
          },
        });
        await tx.auctionStatusHistory.create({
          data: {
            auctionId: id,
            fromStatus: "LIVE",
            toStatus: status,
            reason: reserveMet
              ? "Auction ended."
              : "Reserve amount was not met.",
          },
        });

        if (reserveMet && auction.currentBidId) {
          const winningBid = await tx.bid.findUnique({
            where: { id: auction.currentBidId },
            select: { id: true, bidderId: true },
          });
          if (winningBid) {
            await tx.auctionSettlement.create({
              data: {
                auctionId: id,
                winningBidId: winningBid.id,
                buyerId: winningBid.bidderId,
                sellerId: auction.listing.property.ownerId,
                status: "PENDING",
                dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
              },
            });
            const notification = await tx.notification.create({
              data: {
                userId: winningBid.bidderId,
                type: "auction.won",
                title: "You won the auction",
                body: "Complete settlement within the required period.",
                data: { auctionId: id },
              },
            });
            await tx.outboxEvent.create({
              data: {
                aggregateType: "Notification",
                aggregateId: notification.id,
                eventType: "notification.created",
                payload: {
                  type: "notification.created",
                  userId: winningBid.bidderId,
                  notificationId: notification.id,
                },
              },
            });
          }
        }

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
              data: { status },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            action: "AUCTION_ENDED",
            entityType: "Auction",
            entityId: id,
            after: { status, reserveMet, eventSequence },
          },
        });
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
    );
  }
}
