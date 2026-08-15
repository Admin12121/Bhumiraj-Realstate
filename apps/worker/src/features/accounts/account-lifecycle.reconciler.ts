import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { QUEUES } from "@real-estate/queue";
import { prisma } from "@real-estate/database";
import { workerEnv } from "../../bootstrap-env";

interface PendingUserRow {
  id: string;
}

const ACTIVE_AUCTION_STATES = [
  "SCHEDULED",
  "LIVE",
  "PAUSED",
  "AWAITING_SETTLEMENT",
] as const;

@Injectable()
export class AccountLifecycleReconciler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountLifecycleReconciler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(@InjectQueue(QUEUES.MEDIA) private readonly mediaQueue: Queue) {}

  onModuleInit(): void {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      await this.restoreExpiredBans();
      await this.expirePlatformInvitations();
      await this.schedulePersonalMediaPurges();

      const graceDays = workerEnv.ACCOUNT_DELETION_GRACE_DAYS;

      const candidates = await prisma.$queryRaw<PendingUserRow[]>`
        SELECT id
        FROM "User"
        WHERE "lifecycleStatus" = 'PENDING_DELETION'
          AND "deletionRequestedAt" <= NOW() - (${graceDays} * INTERVAL '1 day')
        ORDER BY "deletionRequestedAt" ASC
        LIMIT 25
      `;

      for (const candidate of candidates) {
        await this.anonymize(candidate.id);
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.stack : "Account lifecycle reconciliation failed",
      );
    } finally {
      this.running = false;
    }
  }


  private async expirePlatformInvitations(): Promise<void> {
    const expired = await prisma.platformInvitation.updateMany({
      where: { status: "PENDING", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
    if (expired.count) {
      this.logger.log(`Expired ${expired.count} pending platform invitations`);
    }
  }

  private async schedulePersonalMediaPurges(): Promise<void> {
    const owners = await prisma.mediaAsset.findMany({
      where: {
        owner: { lifecycleStatus: "DELETED" },
        purpose: {
          in: ["PROFILE_IMAGE", "COVER_IMAGE", "KYC_DOCUMENT", "AGENT_LICENSE"],
        },
        status: { not: "DELETED" },
      },
      distinct: ["ownerId"],
      take: 25,
      select: { ownerId: true },
    });

    await Promise.all(
      owners.map(({ ownerId }) =>
        this.mediaQueue.add(
          "purge-personal",
          { userId: ownerId },
          {
            jobId: `purge-personal-${ownerId}`,
            attempts: 10,
            backoff: { type: "exponential", delay: 5_000 },
            removeOnComplete: true,
            removeOnFail: 1_000,
          },
        ),
      ),
    );
  }

  private async restoreExpiredBans(): Promise<void> {
    const expired = await prisma.user.findMany({
      where: {
        banned: true,
        lifecycleStatus: "SUSPENDED",
        banExpires: { lte: new Date() },
      },
      orderBy: { banExpires: "asc" },
      take: 50,
      select: { id: true },
    });

    for (const { id } of expired) {
      await prisma.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
          where: {
            id,
            banned: true,
            lifecycleStatus: "SUSPENDED",
            banExpires: { lte: new Date() },
          },
          data: {
            banned: false,
            banReason: null,
            banExpires: null,
            lifecycleStatus: "ACTIVE",
          },
        });
        if (!result.count) return;
        await tx.auditLog.create({
          data: {
            action: "USER_UNBANNED",
            entityType: "User",
            entityId: id,
            reason: "Temporary suspension expired",
          },
        });
      });
    }
  }

  private async anonymize(userId: string): Promise<void> {
    await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string; email: string }>>`
          SELECT id, email
          FROM "User"
          WHERE id = ${userId}
            AND "lifecycleStatus" = 'PENDING_DELETION'
          FOR UPDATE SKIP LOCKED
        `;
        const user = locked[0];
        if (!user) return;

        const sellerAuctions = await tx.auction.count({
          where: {
            listing: { createdById: userId },
            status: { in: [...ACTIVE_AUCTION_STATES] },
          },
        });
        const bidderAuctions = await tx.auctionRegistration.count({
          where: {
            userId,
            auction: { status: { in: [...ACTIVE_AUCTION_STATES] } },
          },
        });
        const pendingPayments = await tx.paymentIntent.count({
          where: { userId, status: { in: ["CREATED", "PENDING"] } },
        });
        const openSettlements = await tx.auctionSettlement.count({
          where: {
            OR: [{ buyerId: userId }, { sellerId: userId }],
            status: { notIn: ["SETTLED", "CANCELLED", "VOIDED"] },
          },
        });

        if (sellerAuctions || bidderAuctions || pendingPayments || openSettlements) {
          this.logger.warn(
            `Deletion for ${userId} remains blocked by active business records`,
          );
          return;
        }

        await tx.listing.updateMany({
          where: { createdById: userId, status: { notIn: ["ARCHIVED", "WITHDRAWN"] } },
          data: { status: "WITHDRAWN", withdrawnAt: new Date() },
        });

        await tx.$executeRaw`
          UPDATE "Listing" AS listing
          SET "favoriteCount" = GREATEST(
            0,
            listing."favoriteCount" - favorites.total
          )
          FROM (
            SELECT "listingId", COUNT(*)::int AS total
            FROM "Favorite"
            WHERE "userId" = ${userId}
            GROUP BY "listingId"
          ) AS favorites
          WHERE listing.id = favorites."listingId"
        `;

        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.passkey.deleteMany({ where: { userId } });
        await tx.twoFactor.deleteMany({ where: { userId } });
        await tx.verification.deleteMany({ where: { identifier: user.email } });
        await tx.favorite.deleteMany({ where: { userId } });
        await tx.savedSearch.deleteMany({ where: { userId } });
        await tx.agentFollow.deleteMany({
          where: { OR: [{ followerId: userId }, { agentUserId: userId }] },
        });
        await tx.pushSubscription.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.conversationParticipant.deleteMany({ where: { userId } });
        await tx.agencyMember.deleteMany({ where: { userId } });

        await tx.agentProfile.deleteMany({ where: { userId } });
        await tx.userProfile.updateMany({
          where: { userId },
          data: {
            username: null,
            bio: null,
            phone: null,
            phoneVerifiedAt: null,
            coverImageUrl: null,
            lastSeenAt: null,
          },
        });
        await tx.identityVerification.updateMany({
          where: { userId },
          data: {
            status: "EXPIRED",
            provider: null,
            providerReference: null,
            reviewedById: null,
            reason: null,
          },
        });

        const anonymizedAt = new Date();
        await tx.user.update({
          where: { id: userId },
          data: {
            name: "Deleted user",
            email: `deleted+${userId}@invalid.local`,
            emailVerified: false,
            image: null,
            role: "USER",
            banned: true,
            banReason: "Account deleted by user request",
            banExpires: null,
            twoFactorEnabled: false,
            lifecycleStatus: "DELETED",
            anonymizedAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: "USER_DELETED",
            entityType: "User",
            entityId: userId,
            after: { anonymizedAt: anonymizedAt.toISOString() },
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: "User",
            aggregateId: userId,
            eventType: "user.deleted",
            payload: { userId, anonymizedAt: anonymizedAt.toISOString() },
          },
        });
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 20_000 },
    );
  }
}
