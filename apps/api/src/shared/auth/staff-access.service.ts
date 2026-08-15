import { Injectable, OnModuleInit } from '@nestjs/common';
import { prisma, type AccountType } from '@real-estate/database';
import {
  getRegisteredStaffPermissions,
  isRegisteredStaffPermission,
} from './staff-permission.registry';

export type StaffAccessSnapshot = Readonly<{
  userId: string;
  accountType: AccountType;
  permissions: ReadonlySet<string>;
  roleIds: readonly string[];
  highestRolePosition: number;
  authMethod: string | null;
}>;

@Injectable()
export class StaffAccessService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await this.syncRegisteredPermissions();
  }

  async syncRegisteredPermissions(): Promise<void> {
    const definitions = getRegisteredStaffPermissions();
    if (definitions.length === 0) {
      throw new Error(
        'No staff permissions were registered before synchronization.',
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const definition of definitions) {
        await tx.staffPermission.upsert({
          where: { key: definition.key },
          update: {
            label: definition.label,
            group: definition.group,
            description: definition.description,
          },
          create: definition,
        });
      }
      // Removed keys remain inert because guards accept only registered keys.
      // Deleting them automatically could silently alter role grants without
      // an explicit migration and audit event.
    });
  }

  async resolve(
    userId: string,
    sessionId?: string,
  ): Promise<StaffAccessSnapshot | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        banned: true,
        lifecycleStatus: true,
        staffMembership: { select: { status: true } },
        sessions: sessionId
          ? { where: { id: sessionId }, take: 1, select: { authMethod: true } }
          : false,
        staffRoleAssignments: {
          select: {
            role: {
              select: {
                id: true,
                position: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user || user.banned || user.lifecycleStatus !== 'ACTIVE') return null;
    if (user.role !== 'OWNER' && user.role !== 'STAFF') return null;
    if (user.role === 'STAFF' && user.staffMembership?.status !== 'ACTIVE') {
      return null;
    }

    const roles = user.staffRoleAssignments.map(({ role }) => role);
    const permissions =
      user.role === 'OWNER'
        ? new Set(getRegisteredStaffPermissions().map(({ key }) => key))
        : new Set(
            roles.flatMap((role) =>
              role.permissions.map(({ permission }) => permission.key),
            ),
          );

    return {
      userId: user.id,
      accountType: user.role,
      permissions,
      roleIds: roles.map(({ id }) => id),
      highestRolePosition:
        user.role === 'OWNER'
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, ...roles.map(({ position }) => position)),
      authMethod: Array.isArray(user.sessions)
        ? (user.sessions[0]?.authMethod ?? null)
        : null,
    };
  }

  hasPermission(access: StaffAccessSnapshot, permission: string): boolean {
    return (
      isRegisteredStaffPermission(permission) &&
      (access.accountType === 'OWNER' || access.permissions.has(permission))
    );
  }

  canManageRole(
    access: StaffAccessSnapshot,
    rolePosition: number,
    rolePermissionKeys: readonly string[] = [],
  ): boolean {
    return (
      access.accountType === 'OWNER' ||
      (access.highestRolePosition > rolePosition &&
        rolePermissionKeys.every((permission) =>
          access.permissions.has(permission),
        ))
    );
  }
}
