import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { prisma } from "@real-estate/database";
import { apiEnv } from "../../bootstrap-env";

const ACTIVE_AUCTION_STATES = [
  "SCHEDULED",
  "LIVE",
  "PAUSED",
  "AWAITING_SETTLEMENT",
] as const;

@Injectable()
export class AccountService {
  async overview(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        accounts: { select: { providerId: true } },
        _count: { select: { passkeys: true, sessions: true } },
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      lifecycleStatus: user.lifecycleStatus,
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
      providers: [...new Set(user.accounts.map((account) => account.providerId))],
      passkeyCount: user._count.passkeys,
      sessionCount: user._count.sessions,
    };
  }

  async sessions(userId: string, currentSessionId?: string) {
    const rows = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      current: Boolean(currentSessionId && row.id === currentSessionId),
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    await prisma.session.deleteMany({ where: { id: sessionId, userId } });
    return { revoked: true };
  }

  async requestDeletion(
    userId: string,
    currentSessionId: string,
    confirmation: string,
  ) {
    if (confirmation !== "DELETE MY ACCOUNT") {
      throw new ConflictException({
        code: "DELETION_CONFIRMATION_INVALID",
        message: "The account deletion confirmation text is invalid.",
      });
    }

    const [user, currentSession] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { lifecycleStatus: true },
      }),
      prisma.session.findFirst({
        where: { id: currentSessionId, userId },
        select: { createdAt: true },
      }),
    ]);

    const freshSessionWindowMs = 30 * 60 * 1000;
    if (
      !currentSession ||
      Date.now() - currentSession.createdAt.getTime() > freshSessionWindowMs
    ) {
      throw new ForbiddenException({
        code: "FRESH_SESSION_REQUIRED",
        message: "Sign in again before requesting account deletion.",
      });
    }

    if (user.lifecycleStatus === "DELETED") {
      throw new ConflictException({
        code: "ACCOUNT_ALREADY_DELETED",
        message: "This account has already been deleted.",
      });
    }
    if (user.lifecycleStatus !== "ACTIVE") {
      throw new ConflictException({
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Only an active account can request deletion.",
      });
    }

    const [sellerAuctions, bidderAuctions, pendingPayments, openSettlements] =
      await Promise.all([
        prisma.auction.count({
          where: {
            listing: { createdById: userId },
            status: { in: [...ACTIVE_AUCTION_STATES] },
          },
        }),
        prisma.auctionRegistration.count({
          where: {
            userId,
            auction: { status: { in: [...ACTIVE_AUCTION_STATES] } },
          },
        }),
        prisma.paymentIntent.count({
          where: { userId, status: { in: ["CREATED", "PENDING"] } },
        }),
        prisma.auctionSettlement.count({
          where: {
            OR: [{ buyerId: userId }, { sellerId: userId }],
            status: { notIn: ["SETTLED", "CANCELLED", "VOIDED"] },
          },
        }),
      ]);

    if (sellerAuctions || bidderAuctions || pendingPayments || openSettlements) {
      throw new ConflictException({
        code: "ACCOUNT_DELETION_BLOCKED",
        message:
          "Resolve active auctions, registrations, payments and settlements before deleting the account.",
        details: {
          sellerAuctions,
          bidderAuctions,
          pendingPayments,
          openSettlements,
        },
      });
    }

    const requestedAt = new Date();
    const graceDays = apiEnv.ACCOUNT_DELETION_GRACE_DAYS;
    const scheduledFor = new Date(
      requestedAt.getTime() + graceDays * 24 * 60 * 60 * 1000,
    );

    await prisma.$transaction(async (tx) => {
      await tx.listing.updateMany({
        where: {
          createdById: userId,
          status: { in: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED"] },
        },
        data: { status: "WITHDRAWN", withdrawnAt: requestedAt },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          lifecycleStatus: "PENDING_DELETION",
          deletionRequestedAt: requestedAt,
        },
      });

      await tx.session.deleteMany({
        where: { userId, id: { not: currentSessionId } },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "USER_DELETION_REQUESTED",
          entityType: "User",
          entityId: userId,
          after: { requestedAt: requestedAt.toISOString(), scheduledFor: scheduledFor.toISOString() },
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: "User",
          aggregateId: userId,
          eventType: "user.deletion.requested",
          payload: {
            userId,
            requestedAt: requestedAt.toISOString(),
            scheduledFor: scheduledFor.toISOString(),
          },
        },
      });
    });

    return {
      lifecycleStatus: "PENDING_DELETION",
      requestedAt: requestedAt.toISOString(),
      scheduledFor: scheduledFor.toISOString(),
    };
  }

  async cancelDeletion(userId: string, confirmation: string) {
    if (confirmation !== "KEEP MY ACCOUNT") {
      throw new ConflictException({
        code: "CANCELLATION_CONFIRMATION_INVALID",
        message: "The cancellation confirmation text is invalid.",
      });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lifecycleStatus: true },
    });

    if (user.lifecycleStatus !== "PENDING_DELETION") {
      throw new ConflictException({
        code: "DELETION_NOT_PENDING",
        message: "This account is not pending deletion.",
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { lifecycleStatus: "ACTIVE", deletionRequestedAt: null },
      }),
      prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "USER_UPDATED",
          entityType: "User",
          entityId: userId,
          reason: "Account deletion cancelled",
        },
      }),
      prisma.outboxEvent.create({
        data: {
          aggregateType: "User",
          aggregateId: userId,
          eventType: "user.deletion.cancelled",
          payload: { userId, cancelledAt: new Date().toISOString() },
        },
      }),
    ]);

    return { lifecycleStatus: "ACTIVE" };
  }
}
