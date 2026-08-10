import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@real-estate/database";
import type { z } from "zod";
import { adminUsersQuerySchema } from "@real-estate/contracts";

const ELEVATED_ROLES = new Set(["MODERATOR", "ADMIN", "SUPER_ADMIN"]);

@Injectable()
export class AdminUsersService {
  async list(q: z.infer<typeof adminUsersQuerySchema>) {
    const where = {
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { email: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.status ? { banned: q.status === "banned" } : {}),
    };
    const orderBy =
      q.sort === "name"
        ? { name: q.direction }
        : q.sort === "email"
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
        role: user.role,
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

  async setRole(actorId: string, userId: string, role: string) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext('admin-user-governance'))
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

        if (actorId === userId && role !== target.role) {
          throw new ConflictException({
            code: "SELF_ROLE_CHANGE_BLOCKED",
            message: "Administrators cannot change their own role.",
          });
        }
        if (target.lifecycleStatus === "DELETED") {
          throw new ConflictException({
            code: "DELETED_ACCOUNT_IMMUTABLE",
            message: "A deleted account cannot be assigned a role.",
          });
        }
        if (
          actor.role !== "SUPER_ADMIN" &&
          (ELEVATED_ROLES.has(role) || ELEVATED_ROLES.has(target.role))
        ) {
          throw new ForbiddenException({
            code: "SUPER_ADMIN_REQUIRED",
            message:
              "Only a super administrator can assign or modify elevated roles.",
          });
        }

        await this.assertNotRemovingLastSuperAdmin(
          target.role,
          role,
          () =>
            tx.user.count({
              where: {
                role: "SUPER_ADMIN",
                banned: false,
                lifecycleStatus: "ACTIVE",
              },
            }),
        );

        const user = await tx.user.update({
          where: { id: userId },
          data: { role },
          select: { id: true, role: true },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "USER_ROLE_CHANGED",
            entityType: "User",
            entityId: userId,
            before: { role: target.role },
            after: { role },
          },
        });
        return user;
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
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
        code: "SELF_BAN_BLOCKED",
        message: "You cannot ban your own account.",
      });
    }

    const expires = expiresAt ? new Date(expiresAt) : null;
    if (expires && expires.getTime() <= Date.now()) {
      throw new ConflictException({
        code: "INVALID_BAN_EXPIRY",
        message: "The ban expiry must be in the future.",
      });
    }

    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext('admin-user-governance'))
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

        if (["PENDING_DELETION", "DELETED"].includes(target.lifecycleStatus)) {
          throw new ConflictException({
            code: "ACCOUNT_LIFECYCLE_CONFLICT",
            message: "This account lifecycle state cannot be suspended.",
          });
        }
        if (ELEVATED_ROLES.has(target.role) && actor.role !== "SUPER_ADMIN") {
          throw new ForbiddenException({
            code: "SUPER_ADMIN_REQUIRED",
            message: "Only a super administrator can suspend an elevated account.",
          });
        }
        await this.assertNotRemovingLastSuperAdmin(
          target.role,
          target.role === "SUPER_ADMIN" ? "SUSPENDED" : target.role,
          () =>
            tx.user.count({
              where: {
                role: "SUPER_ADMIN",
                banned: false,
                lifecycleStatus: "ACTIVE",
              },
            }),
        );

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            banned: true,
            banReason: reason,
            banExpires: expires,
            lifecycleStatus: "SUSPENDED",
          },
          select: { id: true },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "USER_BANNED",
            entityType: "User",
            entityId: userId,
            reason,
            before: {
              banned: target.banned,
              lifecycleStatus: target.lifecycleStatus,
            },
            after: {
              banned: true,
              lifecycleStatus: "SUSPENDED",
              expiresAt: expires?.toISOString() ?? null,
            },
          },
        });
        return { id: user.id, banned: true };
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
    );
  }

  async unban(actorId: string, userId: string) {
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext('admin-user-governance'))
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

        if (ELEVATED_ROLES.has(target.role) && actor.role !== "SUPER_ADMIN") {
          throw new ForbiddenException({
            code: "SUPER_ADMIN_REQUIRED",
            message: "Only a super administrator can restore an elevated account.",
          });
        }
        if (!target.banned || target.lifecycleStatus !== "SUSPENDED") {
          throw new ConflictException({
            code: "ACCOUNT_NOT_SUSPENDED",
            message: "This account is not currently suspended.",
          });
        }

        const user = await tx.user.update({
          where: { id: userId },
          data: {
            banned: false,
            banReason: null,
            banExpires: null,
            lifecycleStatus: "ACTIVE",
          },
          select: { id: true },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "USER_UNBANNED",
            entityType: "User",
            entityId: userId,
          },
        });
        return { id: user.id, banned: false };
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
    );
  }

  private async assertNotRemovingLastSuperAdmin(
    currentRole: string,
    nextRole: string,
    countActiveSuperAdmins: () => Promise<number>,
  ) {
    if (currentRole !== "SUPER_ADMIN" || nextRole === "SUPER_ADMIN") return;
    const activeSuperAdmins = await countActiveSuperAdmins();
    if (activeSuperAdmins <= 1) {
      throw new ConflictException({
        code: "LAST_SUPER_ADMIN",
        message: "The final active super administrator cannot be removed.",
      });
    }
  }

  private assertActiveActor(actor: {
    role: string;
    banned: boolean;
    lifecycleStatus: string;
  }): void {
    if (
      actor.banned ||
      actor.lifecycleStatus !== "ACTIVE" ||
      !["ADMIN", "SUPER_ADMIN"].includes(actor.role)
    ) {
      throw new ForbiddenException({
        code: "ADMIN_ACCESS_REVOKED",
        message: "The acting administrator is not authorized.",
      });
    }
  }
}
