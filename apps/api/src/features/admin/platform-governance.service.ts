import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { prisma, type Prisma } from '@real-estate/database';
import { sendResendEmail } from '@real-estate/email';
import type { z } from 'zod';
import {
  createPlatformInvitationSchema,
  platformInvitationsQuerySchema,
  transferOwnershipSchema,
} from '@real-estate/contracts';
import { apiEnv } from '../../bootstrap-env';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from '../../shared/auth/staff-access.service';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class PlatformGovernanceService {
  constructor(private readonly accessService: StaffAccessService) {}

  async listInvitations(
    query: z.infer<typeof platformInvitationsQuerySchema>,
    forcedType?: 'STAFF' | 'AGENT',
  ) {
    await prisma.platformInvitation.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    const invitationType = forcedType ?? query.type;
    const where: Prisma.PlatformInvitationWhereInput = {
      ...(invitationType ? { type: invitationType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { email: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.platformInvitation.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ createdAt: query.direction }, { id: query.direction }],
        include: {
          staffRoles: {
            select: {
              role: {
                select: { id: true, name: true, color: true, position: true },
              },
            },
          },
        },
      }),
      prisma.platformInvitation.count({ where }),
    ]);
    return {
      items: items.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        type: invitation.type,
        status: invitation.status,
        roleIds: invitation.staffRoles.map(({ role }) => role.id),
        roles: invitation.staffRoles.map(({ role }) => role),
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

  async createInvitation(
    actorId: string,
    access: StaffAccessSnapshot,
    input: z.infer<typeof createPlatformInvitationSchema>,
  ) {
    const email = input.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { role: true, lifecycleStatus: true, banned: true },
    });
    if (
      existingUser &&
      (existingUser.role !== 'USER' ||
        existingUser.lifecycleStatus !== 'ACTIVE' ||
        existingUser.banned)
    ) {
      throw new ConflictException({
        code: 'INVITATION_ACCOUNT_CONFLICT',
        message:
          'This email already belongs to an ineligible or privileged account.',
      });
    }

    const roleIds = [...new Set(input.roleIds)];
    if (input.type === 'STAFF') {
      const roles = await prisma.staffRole.findMany({
        where: { id: { in: roleIds } },
        include: {
          permissions: { select: { permission: { select: { key: true } } } },
        },
      });
      if (roles.length !== roleIds.length) {
        throw new NotFoundException('One or more staff roles were not found.');
      }
      for (const role of roles) {
        const manageable = this.accessService.canManageRole(
          access,
          role.position,
          role.permissions.map(({ permission }) => permission.key),
        );
        if (!manageable) {
          throw new ForbiddenException({
            code: 'STAFF_ROLE_HIERARCHY',
            message:
              'You can invite staff only into lower roles whose permissions you hold.',
          });
        }
      }
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
    const invitation = await prisma.$transaction(
      async (tx) => {
        await tx.platformInvitation.updateMany({
          where: { email, type: input.type, status: 'PENDING' },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
        const created = await tx.platformInvitation.create({
          data: {
            email,
            type: input.type,
            tokenHash,
            expiresAt,
            invitedById: actorId,
            ...(input.type === 'STAFF'
              ? {
                  staffRoles: { create: roleIds.map((roleId) => ({ roleId })) },
                }
              : {}),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'PLATFORM_INVITATION_CREATED',
            entityType: 'PlatformInvitation',
            entityId: created.id,
            after: {
              email,
              type: input.type,
              roleIds,
              expiresAt: expiresAt.toISOString(),
            },
          },
        });
        return created;
      },
      { isolationLevel: 'Serializable' },
    );

    const inviteLink = `${apiEnv.APP_URL}/account/invitations?token=${encodeURIComponent(token)}`;
    let delivery: 'SENT' | 'NOT_CONFIGURED' | 'FAILED' = 'NOT_CONFIGURED';
    if (apiEnv.RESEND_API_KEY) {
      try {
        await sendResendEmail({
          apiKey: apiEnv.RESEND_API_KEY,
          from: apiEnv.MAIL_FROM,
          to: email,
          subject: `Invitation to join Bhumiraj Estates as ${input.type === 'STAFF' ? 'staff' : 'an agent'}`,
          text: `Sign in with ${email} and accept your invitation: ${inviteLink}\n\nThis invitation expires in 7 days.`,
        });
        delivery = 'SENT';
      } catch {
        delivery = 'FAILED';
      }
    }
    return {
      id: invitation.id,
      inviteLink,
      delivery,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async revokeInvitation(
    actorId: string,
    invitationId: string,
    type: 'STAFF' | 'AGENT',
  ) {
    const invitation = await prisma.platformInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, email: true, type: true, status: true },
    });
    if (!invitation || invitation.type !== type) throw new NotFoundException();
    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        code: 'INVITATION_NOT_PENDING',
        message: 'Only a pending invitation can be revoked.',
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.platformInvitation.update({
        where: { id: invitationId },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PLATFORM_INVITATION_REVOKED',
          entityType: 'PlatformInvitation',
          entityId: invitationId,
          before: { email: invitation.email, type, status: 'PENDING' },
          after: { status: 'REVOKED' },
        },
      });
    });
    return { id: invitationId, status: 'REVOKED' as const };
  }

  async acceptInvitation(userId: string, rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const invitation = await prisma.platformInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, status: true, expiresAt: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        code: 'INVITATION_NOT_PENDING',
        message: 'This invitation is no longer pending.',
      });
    }
    if (invitation.expiresAt <= new Date()) {
      await prisma.platformInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      throw new ConflictException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired.',
      });
    }

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext('platform-invitation-accept')
          )::text AS lock_result
        `;
        const [currentInvitation, user] = await Promise.all([
          tx.platformInvitation.findUnique({
            where: { tokenHash },
            include: { staffRoles: { select: { roleId: true } } },
          }),
          tx.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              emailVerified: true,
              role: true,
              lifecycleStatus: true,
              banned: true,
            },
          }),
        ]);
        if (!currentInvitation || currentInvitation.status !== 'PENDING') {
          throw new ConflictException('This invitation is no longer pending.');
        }
        if (
          !user ||
          user.role !== 'USER' ||
          user.lifecycleStatus !== 'ACTIVE' ||
          user.banned
        ) {
          throw new ConflictException({
            code: 'INVITATION_ACCOUNT_INELIGIBLE',
            message:
              'Only an active customer account can accept this invitation.',
          });
        }
        if (
          !user.emailVerified ||
          user.email.toLowerCase() !== currentInvitation.email
        ) {
          throw new ForbiddenException({
            code: 'INVITATION_EMAIL_MISMATCH',
            message:
              'Sign in with the verified email address that received this invitation.',
          });
        }

        if (currentInvitation.type === 'STAFF') {
          const roleIds = currentInvitation.staffRoles.map(
            ({ roleId }) => roleId,
          );
          if (roleIds.length === 0)
            throw new ConflictException('The staff invitation has no roles.');
          await tx.user.update({
            where: { id: userId },
            data: { role: 'STAFF' },
          });
          await tx.staffMembership.upsert({
            where: { userId },
            update: {
              status: 'ACTIVE',
              managedById: currentInvitation.invitedById,
              statusReason: null,
              activatedAt: new Date(),
              suspendedAt: null,
              revokedAt: null,
            },
            create: {
              userId,
              status: 'ACTIVE',
              managedById: currentInvitation.invitedById,
              activatedAt: new Date(),
            },
          });
          await tx.staffUserRole.createMany({
            data: roleIds.map((roleId) => ({
              userId,
              roleId,
              grantedById: currentInvitation.invitedById,
            })),
          });
        } else {
          await tx.user.update({
            where: { id: userId },
            data: { role: 'AGENT' },
          });
          await tx.agentProfile.upsert({
            where: { userId },
            update: {
              status: 'PENDING',
              availabilityStatus: 'UNAVAILABLE',
              statusReason: null,
              suspendedAt: null,
              retiredAt: null,
              updatedById: currentInvitation.invitedById,
            },
            create: {
              userId,
              status: 'PENDING',
              availabilityStatus: 'UNAVAILABLE',
              createdById: currentInvitation.invitedById,
              updatedById: currentInvitation.invitedById,
            },
          });
        }
        await tx.platformInvitation.update({
          where: { id: currentInvitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedById: userId,
            acceptedAt: new Date(),
          },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'PLATFORM_INVITATION_ACCEPTED',
            entityType: 'PlatformInvitation',
            entityId: currentInvitation.id,
            after: {
              type: currentInvitation.type,
              accountType: currentInvitation.type,
            },
          },
        });
        return {
          id: currentInvitation.id,
          accountType: currentInvitation.type,
          requiresSignIn: true,
        };
      },
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 },
    );
  }

  async transferOwnership(
    actorId: string,
    access: StaffAccessSnapshot,
    input: z.infer<typeof transferOwnershipSchema>,
  ) {
    if (access.accountType !== 'OWNER') {
      throw new ForbiddenException({
        code: 'OWNER_REQUIRED',
        message: 'Only the current owner can transfer ownership.',
      });
    }
    if (actorId === input.targetUserId) {
      throw new ConflictException('The owner already owns the platform.');
    }
    const roleIds = [...new Set(input.previousOwnerRoleIds)];
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(
            hashtext('platform-owner-transfer')
          )::text AS lock_result
        `;
        const [actor, target, roles, ownerCount] = await Promise.all([
          tx.user.findUnique({
            where: { id: actorId },
            select: { role: true, email: true },
          }),
          tx.user.findUnique({
            where: { id: input.targetUserId },
            select: {
              role: true,
              email: true,
              emailVerified: true,
              twoFactorEnabled: true,
              banned: true,
              lifecycleStatus: true,
              staffMembership: { select: { status: true } },
              staffRoleAssignments: { select: { roleId: true } },
            },
          }),
          tx.staffRole.findMany({
            where: { id: { in: roleIds } },
            select: { id: true },
          }),
          tx.user.count({ where: { role: 'OWNER' } }),
        ]);
        if (!actor || actor.role !== 'OWNER' || ownerCount !== 1) {
          throw new ConflictException({
            code: 'OWNER_INVARIANT_FAILED',
            message:
              'Ownership changed or the single-owner invariant is not satisfied.',
          });
        }
        if (
          !target ||
          target.role !== 'STAFF' ||
          target.staffMembership?.status !== 'ACTIVE' ||
          target.lifecycleStatus !== 'ACTIVE' ||
          target.banned
        ) {
          throw new ConflictException({
            code: 'OWNER_TARGET_INELIGIBLE',
            message: 'The new owner must be an active staff member.',
          });
        }
        if (!target.emailVerified || !target.twoFactorEnabled) {
          throw new ConflictException({
            code: 'OWNER_TARGET_STRONG_AUTH_REQUIRED',
            message:
              'The new owner must have a verified email and two-factor authentication enabled.',
          });
        }
        if (roles.length !== roleIds.length) {
          throw new NotFoundException(
            'One or more fallback staff roles were not found.',
          );
        }

        const targetPreviousRoleIds = target.staffRoleAssignments.map(
          ({ roleId }) => roleId,
        );
        await tx.user.update({
          where: { id: actorId },
          data: { role: 'STAFF' },
        });
        await tx.staffMembership.upsert({
          where: { userId: actorId },
          update: {
            status: 'ACTIVE',
            managedById: input.targetUserId,
            statusReason: null,
            activatedAt: new Date(),
            suspendedAt: null,
            revokedAt: null,
          },
          create: {
            userId: actorId,
            status: 'ACTIVE',
            managedById: input.targetUserId,
            activatedAt: new Date(),
          },
        });
        await tx.staffUserRole.deleteMany({ where: { userId: actorId } });
        await tx.staffUserRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: actorId,
            roleId,
            grantedById: input.targetUserId,
          })),
        });
        await tx.user.update({
          where: { id: input.targetUserId },
          data: { role: 'OWNER' },
        });
        await tx.staffUserRole.deleteMany({
          where: { userId: input.targetUserId },
        });
        await tx.staffMembership.update({
          where: { userId: input.targetUserId },
          data: {
            status: 'REVOKED',
            managedById: input.targetUserId,
            statusReason: 'Membership replaced by platform ownership',
            revokedAt: new Date(),
          },
        });
        await tx.session.deleteMany({
          where: { userId: { in: [actorId, input.targetUserId] } },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'OWNER_TRANSFERRED',
            entityType: 'PlatformOwner',
            entityId: input.targetUserId,
            before: {
              ownerId: actorId,
              ownerEmail: actor.email,
              targetRoleIds: targetPreviousRoleIds,
            },
            after: {
              ownerId: input.targetUserId,
              ownerEmail: target.email,
              previousOwnerRoleIds: roleIds,
            },
          },
        });
        return {
          ownerId: input.targetUserId,
          previousOwnerId: actorId,
          requiresSignIn: true,
        };
      },
      { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 15_000 },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
