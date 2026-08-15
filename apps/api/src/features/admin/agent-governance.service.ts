import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@real-estate/database';

@Injectable()
export class AgentGovernanceService {
  async searchCandidates(search: string) {
    return prisma.user.findMany({
      where: {
        role: 'USER',
        lifecycleStatus: 'ACTIVE',
        banned: false,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, email: true },
    });
  }

  async createAgent(actorId: string, userId: string) {
    if (actorId === userId)
      throw new ConflictException('You cannot convert your own account.');
    return prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true, lifecycleStatus: true, banned: true },
        });
        if (!user) throw new NotFoundException();
        if (
          user.role !== 'USER' ||
          user.lifecycleStatus !== 'ACTIVE' ||
          user.banned
        ) {
          throw new ConflictException({
            code: 'AGENT_ACCOUNT_INELIGIBLE',
            message: 'Only an active customer can be onboarded as an agent.',
          });
        }
        await tx.user.update({
          where: { id: userId },
          data: { role: 'AGENT' },
        });
        const profile = await tx.agentProfile.upsert({
          where: { userId },
          update: {
            status: 'PENDING',
            availabilityStatus: 'UNAVAILABLE',
            statusReason: null,
            suspendedAt: null,
            retiredAt: null,
            updatedById: actorId,
          },
          create: {
            userId,
            status: 'PENDING',
            availabilityStatus: 'UNAVAILABLE',
            createdById: actorId,
            updatedById: actorId,
          },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'AGENT_CREATED',
            entityType: 'AgentProfile',
            entityId: profile.id,
            before: { accountType: 'USER' },
            after: { accountType: 'AGENT', status: 'PENDING' },
          },
        });
        return { id: profile.id, userId, status: profile.status };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async setStatus(
    actorId: string,
    profileId: string,
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED',
    reason?: string | null,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const profile = await tx.agentProfile.findUnique({
          where: { id: profileId },
          select: {
            id: true,
            userId: true,
            status: true,
            availabilityStatus: true,
            statusReason: true,
            verifiedAt: true,
            user: {
              select: { role: true, lifecycleStatus: true, banned: true },
            },
          },
        });
        if (!profile) throw new NotFoundException();
        if (profile.status === 'RETIRED') {
          throw new ConflictException({
            code: 'AGENT_RETIRED_TERMINAL',
            message:
              'A retired agent cannot be reactivated. Start a new reviewed onboarding instead.',
          });
        }
        if (profile.user.role !== 'AGENT') {
          throw new ConflictException('The agent account type has changed.');
        }
        if (
          status === 'ACTIVE' &&
          (profile.user.lifecycleStatus !== 'ACTIVE' || profile.user.banned)
        ) {
          throw new ConflictException(
            'An inactive account cannot become an active agent.',
          );
        }
        const now = new Date();
        const statusReason =
          status === 'SUSPENDED' || status === 'RETIRED'
            ? (reason ?? null)
            : null;
        const updated = await tx.agentProfile.update({
          where: { id: profileId },
          data: {
            status,
            statusReason,
            verifiedAt:
              status === 'ACTIVE'
                ? now
                : status === 'PENDING'
                  ? null
                  : profile.verifiedAt,
            availabilityStatus:
              status === 'SUSPENDED' || status === 'RETIRED'
                ? 'UNAVAILABLE'
                : profile.availabilityStatus,
            suspendedAt: status === 'SUSPENDED' ? now : null,
            retiredAt: status === 'RETIRED' ? now : null,
            updatedById: actorId,
          },
        });
        if (status === 'RETIRED') {
          await tx.user.update({
            where: { id: profile.userId },
            data: { role: 'USER' },
          });
        }
        if (status === 'SUSPENDED' || status === 'RETIRED') {
          await tx.session.deleteMany({ where: { userId: profile.userId } });
        }
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'AGENT_STATUS_CHANGED',
            entityType: 'AgentProfile',
            entityId: profileId,
            reason: statusReason,
            before: {
              status: profile.status,
              availabilityStatus: profile.availabilityStatus,
              reason: profile.statusReason,
            },
            after: {
              status,
              availabilityStatus: updated.availabilityStatus,
              accountType: status === 'RETIRED' ? 'USER' : 'AGENT',
            },
          },
        });
        return { id: profileId, status: updated.status };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async setAvailability(
    actorId: string,
    profileId: string,
    availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'AT_CAPACITY',
    maxActiveCases: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const profile = await tx.agentProfile.findUnique({
        where: { id: profileId },
        select: {
          status: true,
          availabilityStatus: true,
          maxActiveCases: true,
        },
      });
      if (!profile) throw new NotFoundException();
      if (profile.status !== 'ACTIVE') {
        throw new ConflictException({
          code: 'AGENT_NOT_ACTIVE',
          message: 'Availability can be changed only for an active agent.',
        });
      }
      const updated = await tx.agentProfile.update({
        where: { id: profileId },
        data: { availabilityStatus, maxActiveCases, updatedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'AGENT_AVAILABILITY_CHANGED',
          entityType: 'AgentProfile',
          entityId: profileId,
          before: {
            availabilityStatus: profile.availabilityStatus,
            maxActiveCases: profile.maxActiveCases,
          },
          after: { availabilityStatus, maxActiveCases },
        },
      });
      return {
        id: profileId,
        availabilityStatus: updated.availabilityStatus,
        maxActiveCases: updated.maxActiveCases,
      };
    });
  }
}
