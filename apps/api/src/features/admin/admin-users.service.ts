import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@real-estate/database';
import type { z } from 'zod';
import { adminUsersQuerySchema } from '@real-estate/contracts';

@Injectable()
export class AdminUsersService {
  async list(q: z.infer<typeof adminUsersQuerySchema>) {
    const where = {
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { email: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(q.accountType ? { role: q.accountType } : {}),
      ...(q.status ? { banned: q.status === 'banned' } : {}),
    };
    const orderBy =
      q.sort === 'name'
        ? { name: q.direction }
        : q.sort === 'email'
          ? { email: q.direction }
          : { createdAt: q.direction };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          banned: true,
          emailVerified: true,
          twoFactorEnabled: true,
          lifecycleStatus: true,
          createdAt: true,
          profile: { select: { lastSeenAt: true } },
          _count: { select: { listings: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.role,
        banned: user.banned,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        lifecycleStatus: user.lifecycleStatus,
        listings: user._count.listings,
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.profile?.lastSeenAt?.toISOString() ?? null,
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
      pageCount: Math.ceil(total / q.pageSize),
    };
  }

  async setAccountType(
    actorId: string,
    userId: string,
    accountType: 'USER' | 'AGENT',
  ) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext('admin-user-governance')
          )::text AS lock_result
        `;
        const [actor, target] = await Promise.all([
          tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, banned: true, lifecycleStatus: true },
          }),
          tx.user.findUnique({
            where: { id: userId },
            select: { role: true, banned: true, lifecycleStatus: true },
          }),
        ]);
        if (!actor || !target) throw new NotFoundException();
        this.assertActiveActor(actor);

        if (actorId === userId && accountType !== target.role) {
          throw new ConflictException({
            code: 'SELF_ROLE_CHANGE_BLOCKED',
            message: 'Staff cannot change their own account type.',
          });
        }
        if (target.lifecycleStatus === 'DELETED') {
          throw new ConflictException({
            code: 'DELETED_ACCOUNT_IMMUTABLE',
            message: 'A deleted account cannot be assigned a role.',
          });
        }
        if (target.role === 'OWNER' || target.role === 'STAFF') {
          throw new ForbiddenException({
            code: 'STAFF_GOVERNANCE_REQUIRED',
            message:
              'Owner and staff account types are managed through staff governance.',
          });
        }
        if (target.role === 'AGENT') {
          throw new ForbiddenException({
            code: 'AGENT_GOVERNANCE_REQUIRED',
            message:
              'Agent accounts must be suspended or retired through agent governance.',
          });
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: { role: accountType },
          select: { id: true, role: true },
        });
        if (accountType === 'AGENT') {
          const profile = await tx.agentProfile.upsert({
            where: { userId },
            update: {
              status: 'PENDING',
              availabilityStatus: 'UNAVAILABLE',
              statusReason: null,
              retiredAt: null,
              suspendedAt: null,
              updatedById: actorId,
            },
            create: { userId, createdById: actorId, updatedById: actorId },
          });
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'AGENT_CREATED',
              entityType: 'AgentProfile',
              entityId: profile.id,
              before: { accountType: target.role },
              after: { accountType: 'AGENT', status: 'PENDING' },
            },
          });
        }
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'ACCOUNT_TYPE_CHANGED',
            entityType: 'User',
            entityId: userId,
            before: { accountType: target.role },
            after: { accountType },
          },
        });
        return { id: user.id, accountType: user.role };
      },
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 },
    );
  }

  async ban(
    actorId: string,
    userId: string,
    reason: string,
    expiresAt?: string | null,
  ) {
    if (actorId === userId) {
      throw new ConflictException({
        code: 'SELF_BAN_BLOCKED',
        message: 'You cannot ban your own account.',
      });
    }

    const expires = expiresAt ? new Date(expiresAt) : null;
    if (expires && expires.getTime() <= Date.now()) {
      throw new ConflictException({
        code: 'INVALID_BAN_EXPIRY',
        message: 'The ban expiry must be in the future.',
      });
    }

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext('admin-user-governance')
          )::text AS lock_result
        `;
        const [actor, target] = await Promise.all([
          tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, banned: true, lifecycleStatus: true },
          }),
          tx.user.findUnique({
            where: { id: userId },
            select: { role: true, banned: true, lifecycleStatus: true },
          }),
        ]);
        if (!actor || !target) throw new NotFoundException();
        this.assertActiveActor(actor);

        if (['PENDING_DELETION', 'DELETED'].includes(target.lifecycleStatus)) {
          throw new ConflictException({
            code: 'ACCOUNT_LIFECYCLE_CONFLICT',
            message: 'This account lifecycle state cannot be suspended.',
          });
        }
        if (target.role === 'OWNER') {
          throw new ForbiddenException({
            code: 'OWNER_PROTECTED',
            message: 'The application owner cannot be suspended.',
          });
        }
        if (target.role === 'STAFF' && actor.role !== 'OWNER') {
          throw new ForbiddenException({
            code: 'OWNER_REQUIRED',
            message: 'Only the application owner can suspend staff accounts.',
          });
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            banned: true,
            banReason: reason,
            banExpires: expires,
            lifecycleStatus: 'SUSPENDED',
          },
          select: { id: true },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'USER_BANNED',
            entityType: 'User',
            entityId: userId,
            reason,
            before: {
              banned: target.banned,
              lifecycleStatus: target.lifecycleStatus,
            },
            after: {
              banned: true,
              lifecycleStatus: 'SUSPENDED',
              expiresAt: expires?.toISOString() ?? null,
            },
          },
        });
        return { id: user.id, banned: true };
      },
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 },
    );
  }

  async unban(actorId: string, userId: string) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext('admin-user-governance')
          )::text AS lock_result
        `;
        const [actor, target] = await Promise.all([
          tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, banned: true, lifecycleStatus: true },
          }),
          tx.user.findUnique({
            where: { id: userId },
            select: { role: true, banned: true, lifecycleStatus: true },
          }),
        ]);
        if (!actor || !target) throw new NotFoundException();
        this.assertActiveActor(actor);

        if (target.role === 'OWNER') {
          throw new ForbiddenException({
            code: 'OWNER_PROTECTED',
            message:
              'The application owner account is not governed by staff status actions.',
          });
        }
        if (target.role === 'STAFF' && actor.role !== 'OWNER') {
          throw new ForbiddenException({
            code: 'OWNER_REQUIRED',
            message: 'Only the application owner can restore staff accounts.',
          });
        }
        if (!target.banned || target.lifecycleStatus !== 'SUSPENDED') {
          throw new ConflictException({
            code: 'ACCOUNT_NOT_SUSPENDED',
            message: 'This account is not currently suspended.',
          });
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            banned: false,
            banReason: null,
            banExpires: null,
            lifecycleStatus: 'ACTIVE',
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'USER_UNBANNED',
            entityType: 'User',
            entityId: userId,
          },
        });
        return { id: user.id, banned: false };
      },
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 },
    );
  }

  private assertActiveActor(actor: {
    role: string;
    banned: boolean;
    lifecycleStatus: string;
  }): void {
    if (
      actor.banned ||
      actor.lifecycleStatus !== 'ACTIVE' ||
      !['OWNER', 'STAFF'].includes(actor.role)
    ) {
      throw new ForbiddenException({
        code: 'ADMIN_ACCESS_REVOKED',
        message: 'The acting administrator is not authorized.',
      });
    }
  }

  /**
   * One account, assembled for the console's detail page.
   *
   * Agents are gathered from two directions because "who has this customer
   * dealt with" has two answers: people they messaged, and the agent actually
   * representing a listing of theirs. Either alone reads as a gap.
   */
  async detail(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        banReason: true,
        emailVerified: true,
        twoFactorEnabled: true,
        lifecycleStatus: true,
        image: true,
        createdAt: true,
        profile: { select: { lastSeenAt: true, phone: true, username: true } },
        accounts: { select: { providerId: true } },
        _count: {
          select: {
            listings: true,
            conversationParticipants: true,
            bids: true,
            favorites: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    const [listings, payments, conversationPeers, assignedAgents, paymentCount] =
      await Promise.all([
        prisma.listing.findMany({
          where: { createdById: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            type: true,
            priceMinor: true,
            currency: true,
            createdAt: true,
          },
        }),
        prisma.listingPaymentProof.findMany({
          where: { submittedById: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            listingId: true,
            method: true,
            reference: true,
            amountMinor: true,
            currency: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            reviewedAt: true,
            listing: { select: { title: true } },
          },
        }),
        prisma.conversationParticipant.findMany({
          where: {
            userId: { not: id },
            conversation: { participants: { some: { userId: id } } },
            user: { role: 'AGENT' },
          },
          orderBy: { joinedAt: 'desc' },
          take: 50,
          select: {
            joinedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.listingAssignment.findMany({
          where: { status: 'ACCEPTED', listing: { createdById: id } },
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: {
            updatedAt: true,
            agent: {
              select: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        }),
        prisma.listingPaymentProof.count({ where: { submittedById: id } }),
      ]);

    // One row per agent; the closer relationship (representing) wins the label.
    const agents = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        via: 'CONVERSATION' | 'ASSIGNMENT';
        lastContactAt: string | null;
      }
    >();
    for (const row of conversationPeers) {
      agents.set(row.user.id, {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        via: 'CONVERSATION',
        lastContactAt: row.joinedAt.toISOString(),
      });
    }
    for (const row of assignedAgents) {
      const agent = row.agent.user;
      agents.set(agent.id, {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        via: 'ASSIGNMENT',
        lastContactAt: row.updatedAt.toISOString(),
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      accountType: user.role,
      banned: user.banned ?? false,
      banReason: user.banReason ?? null,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      lifecycleStatus: user.lifecycleStatus,
      image: user.image,
      phone: user.profile?.phone ?? null,
      username: user.profile?.username ?? null,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.profile?.lastSeenAt?.toISOString() ?? null,
      providers: user.accounts.map((account) => account.providerId),
      counts: {
        listings: user._count.listings,
        conversations: user._count.conversationParticipants,
        payments: paymentCount,
        bids: user._count.bids,
        favorites: user._count.favorites,
      },
      listings: listings.map((listing) => ({
        ...listing,
        priceMinor: listing.priceMinor?.toString() ?? null,
        createdAt: listing.createdAt.toISOString(),
      })),
      agents: [...agents.values()],
      payments: payments.map((proof) => ({
        id: proof.id,
        listingId: proof.listingId,
        listingTitle: proof.listing.title,
        method: proof.method,
        reference: proof.reference,
        amountMinor: proof.amountMinor.toString(),
        currency: proof.currency,
        status: proof.status,
        rejectionReason: proof.rejectionReason,
        createdAt: proof.createdAt.toISOString(),
        reviewedAt: proof.reviewedAt?.toISOString() ?? null,
      })),
    };
  }
}
