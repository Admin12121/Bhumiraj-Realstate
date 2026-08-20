import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  adminAgentsQuerySchema,
  adminAuditQuerySchema,
  adminModerationQuerySchema,
  adminPaginationQuerySchema,
  idSchema,
  moderationDecisionSchema,
  platformSettingsSchema,
} from '@real-estate/contracts';
import { prisma, type Prisma } from '@real-estate/database';
import {
  StaffPermissions,
  StrongAuth,
} from '../../shared/auth/staff-permissions.decorator';
import { StaffPermissionsGuard } from '../../shared/auth/staff-permissions.guard';
import { ZodValidationPipe } from '../../shared/http/zod-validation.pipe';
import { ADMIN_PERMISSIONS } from './admin.permissions';

const moderationKindSchema = z.enum(['listing', 'user']);

const DEFAULT_SETTINGS = {
  propertyModerationRequired: true,
  auctionIdentityRequired: true,
  defaultAuctionExtensionWindowSeconds: 120,
  defaultAuctionExtensionDurationSeconds: 120,
  maximumPropertyImages: 50,
};

@Controller('api/v1/admin')
@UseGuards(StaffPermissionsGuard)
export class AdminOperationsController {
  @Get('overview')
  @StaffPermissions(ADMIN_PERMISSIONS.OVERVIEW_READ)
  async overview() {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Trailing window for the pulse chart and heatmap.
    const WINDOW_DAYS = 45;
    const windowStart = new Date(startOfDay);
    windowStart.setUTCDate(windowStart.getUTCDate() - (WINDOW_DAYS - 1));

    const [
      activeListings,
      liveAuctions,
      verifiedUsers,
      pendingListingReviews,
      openListingReports,
      openUserReports,
      totalUsers,
      verifiedAgents,
      bidsToday,
      outboxBacklog,
      recentActivity,
      pendingListings,
      paymentsAwaitingReview,
      listingsAwaitingAgent,
      openAgentOffers,
      listingSeries,
      bidSeries,
      signupSeries,
      eventSeries,
    ] = await prisma.$transaction([
      prisma.listing.count({ where: { status: 'PUBLISHED' } }),
      prisma.auction.count({ where: { status: 'LIVE' } }),
      prisma.user.count({
        where: {
          emailVerified: true,
          banned: false,
          lifecycleStatus: 'ACTIVE',
        },
      }),
      prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.listingReport.count({
        where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      }),
      prisma.userReport.count({
        where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      }),
      prisma.user.count(),
      prisma.agentProfile.count({ where: { verifiedAt: { not: null } } }),
      prisma.bid.count({ where: { acceptedAt: { gte: startOfDay } } }),
      prisma.outboxEvent.count({
        where: { status: { in: ['PENDING', 'FAILED'] } },
      }),
      prisma.auditLog.findMany({
        take: 8,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      }),
      prisma.listing.findMany({
        where: { status: 'PENDING_REVIEW' },
        take: 5,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      }),
      prisma.listingPaymentProof.count({ where: { status: 'SUBMITTED' } }),
      prisma.listing.count({ where: { status: 'AWAITING_AGENT' } }),
      prisma.listingAssignment.count({ where: { status: 'OFFERED' } }),
      prisma.listing.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.bid.findMany({
        where: { acceptedAt: { gte: windowStart } },
        select: { acceptedAt: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
    ]);

    /** Bucket timestamps into UTC days so every day in the window exists. */
    const dayKey = (value: Date) => value.toISOString().slice(0, 10);
    const buckets = new Map<
      string,
      { listings: number; bids: number; signups: number; events: number }
    >();
    for (let index = 0; index < WINDOW_DAYS; index += 1) {
      const day = new Date(windowStart);
      day.setUTCDate(day.getUTCDate() + index);
      buckets.set(dayKey(day), {
        listings: 0,
        bids: 0,
        signups: 0,
        events: 0,
      });
    }
    const tally = (
      rows: { createdAt?: Date | null; acceptedAt?: Date | null }[],
      field: 'listings' | 'bids' | 'signups' | 'events',
    ) => {
      for (const row of rows) {
        const at = row.createdAt ?? row.acceptedAt;
        if (!at) continue;
        const bucket = buckets.get(dayKey(at));
        if (bucket) bucket[field] += 1;
      }
    };
    tally(listingSeries, 'listings');
    tally(bidSeries, 'bids');
    tally(signupSeries, 'signups');
    tally(eventSeries, 'events');

    return {
      counts: {
        activeListings,
        liveAuctions,
        verifiedUsers,
        pendingReviews:
          pendingListingReviews + openListingReports + openUserReports,
        totalUsers,
        verifiedAgents,
        bidsToday,
        outboxBacklog,
        paymentsAwaitingReview,
        listingsAwaitingAgent,
        openAgentOffers,
      },
      daily: [...buckets.entries()].map(([date, counts]) => ({
        date,
        ...counts,
      })),
      recentActivity: recentActivity.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorName: row.actor?.name ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      pendingListings: pendingListings.map((row) => ({
        id: row.id,
        title: row.title,
        ownerName: row.createdBy.name,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
  @Get('moderation')
  @StaffPermissions(ADMIN_PERMISSIONS.MODERATION_READ)
  async moderation(
    @Query(new ZodValidationPipe(adminModerationQuerySchema))
    query: z.infer<typeof adminModerationQuerySchema>,
  ) {
    const skip = (query.page - 1) * query.pageSize;
    if (query.kind === 'USER_REPORT') {
      const where: Prisma.UserReportWhereInput = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  reason: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  reportedUser: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
                {
                  reportedUser: {
                    email: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            }
          : {}),
      };
      const [rows, total] = await prisma.$transaction([
        prisma.userReport.findMany({
          where,
          skip,
          take: query.pageSize,
          orderBy: { createdAt: query.direction },
          include: {
            reporter: { select: { id: true, name: true, email: true } },
            reportedUser: { select: { id: true, name: true } },
          },
        }),
        prisma.userReport.count({ where }),
      ]);
      return this.page(
        rows.map((row) => ({
          id: row.id,
          kind: 'USER_REPORT' as const,
          subjectId: row.reportedUserId,
          subjectLabel: row.reportedUser.name,
          reporter: row.reporter,
          reason: row.reason,
          details: row.details,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        })),
        total,
        query,
      );
    }

    const where: Prisma.ListingReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                reason: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                listing: {
                  title: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.listingReport.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: query.direction },
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          listing: { select: { id: true, title: true } },
        },
      }),
      prisma.listingReport.count({ where }),
    ]);
    return this.page(
      rows.map((row) => ({
        id: row.id,
        kind: 'LISTING_REPORT' as const,
        subjectId: row.listingId,
        subjectLabel: row.listing.title,
        reporter: row.reporter,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  @Patch('moderation/:kind/:id')
  @StaffPermissions(ADMIN_PERMISSIONS.MODERATION_MANAGE)
  async moderate(
    @Param('kind', new ZodValidationPipe(moderationKindSchema))
    kind: z.infer<typeof moderationKindSchema>,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(moderationDecisionSchema))
    body: { status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'; reason: string },
    @Session() session: UserSession,
  ) {
    return prisma.$transaction(async (tx) => {
      if (kind === 'listing') {
        await tx.listingReport.update({
          where: { id },
          data: { status: body.status },
        });
      } else {
        await tx.userReport.update({
          where: { id },
          data: { status: body.status },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'REPORT_REVIEWED',
          entityType: kind === 'listing' ? 'ListingReport' : 'UserReport',
          entityId: id,
          reason: body.reason,
          after: { status: body.status },
        },
      });
      return { id, status: body.status };
    });
  }

  @Get('agents')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_READ)
  async agents(
    @Query(new ZodValidationPipe(adminAgentsQuerySchema))
    query: z.infer<typeof adminAgentsQuerySchema>,
  ) {
    const where: Prisma.AgentProfileWhereInput = {
      ...(query.search
        ? {
            OR: [
              {
                user: {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                user: {
                  email: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                licenseNumber: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
      ...(query.verified !== undefined
        ? { verifiedAt: query.verified ? { not: null } : null }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.availabilityStatus
        ? { availabilityStatus: query.availabilityStatus }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.agentProfile.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.direction },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              _count: {
                select: { listings: { where: { status: 'PUBLISHED' } } },
              },
            },
          },
        },
      }),
      prisma.agentProfile.count({ where }),
    ]);
    return this.page(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.user.name,
        email: row.user.email,
        licenseNumber: row.licenseNumber,
        verifiedAt: row.verifiedAt?.toISOString() ?? null,
        status: row.status,
        availabilityStatus: row.availabilityStatus,
        maxActiveCases: row.maxActiveCases,
        statusReason: row.statusReason,
        averageRating: Number(row.averageRating),
        reviewCount: row.reviewCount,
        activeListings: row.user._count.listings,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  @Get('audit')
  @StaffPermissions(ADMIN_PERMISSIONS.AUDIT_READ)
  async audit(
    @Query(new ZodValidationPipe(adminAuditQuerySchema))
    query: z.infer<typeof adminAuditQuerySchema>,
  ) {
    const where = {
      ...(query.search
        ? {
            OR: [
              {
                entityId: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                reason: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                actor: {
                  email: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: query.direction },
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return this.page(
      rows.map((row) => ({
        id: row.id,
        actor: row.actor,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        reason: row.reason,
        requestId: row.requestId,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  @Get('messages')
  @StaffPermissions(ADMIN_PERMISSIONS.MESSAGES_READ)
  async messages(
    @Query(new ZodValidationPipe(adminPaginationQuerySchema))
    query: z.infer<typeof adminPaginationQuerySchema>,
  ) {
    const where = {
      type: 'SUPPORT' as const,
      ...(query.search
        ? {
            OR: [
              {
                messages: {
                  some: {
                    body: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
              {
                participants: {
                  some: {
                    user: {
                      email: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { updatedAt: query.direction },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { body: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);
    return this.page(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        participants: row.participants.map((participant) => participant.user),
        lastMessage: row.messages[0]
          ? {
              body: row.messages[0].body,
              createdAt: row.messages[0].createdAt.toISOString(),
            }
          : null,
        messageCount: row._count.messages,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      query,
    );
  }

  @Get('settings')
  @StaffPermissions(ADMIN_PERMISSIONS.SETTINGS_READ)
  async settings() {
    const row = await prisma.systemSetting.findUnique({
      where: { key: 'platform' },
    });
    return platformSettingsSchema.parse(row?.value ?? DEFAULT_SETTINGS);
  }

  @Patch('settings')
  @StaffPermissions(ADMIN_PERMISSIONS.SETTINGS_MANAGE)
  @StrongAuth()
  async updateSettings(
    @Body(new ZodValidationPipe(platformSettingsSchema))
    body: z.infer<typeof platformSettingsSchema>,
    @Session() session: UserSession,
  ) {
    const before = await prisma.systemSetting.findUnique({
      where: { key: 'platform' },
    });
    await prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: 'platform' },
        update: { value: body, updatedById: session.user.id },
        create: { key: 'platform', value: body, updatedById: session.user.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'SETTINGS_UPDATED',
          entityType: 'SystemSetting',
          entityId: 'platform',
          before: before?.value ?? DEFAULT_SETTINGS,
          after: body,
        },
      });
    });
    return body;
  }

  private page(
    items: unknown[],
    total: number,
    query: { page: number; pageSize: number },
  ) {
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }
}
