import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, type Prisma } from '@real-estate/database';
import type { z } from 'zod';
import {
  createStaffMemberSchema,
  createStaffRoleSchema,
  staffMembersQuerySchema,
  updateStaffRoleSchema,
} from '@real-estate/contracts';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from '../../shared/auth/staff-access.service';
import { isRegisteredStaffPermission } from '../../shared/auth/staff-permission.registry';

@Injectable()
export class StaffRbacService {
  constructor(private readonly accessService: StaffAccessService) {}

  async catalog(access: StaffAccessSnapshot) {
    const [roles, permissions] = await prisma.$transaction([
      prisma.staffRole.findMany({
        orderBy: [{ position: 'desc' }, { name: 'asc' }],
        include: {
          permissions: { select: { permission: { select: { key: true } } } },
          _count: { select: { members: true } },
        },
      }),
      prisma.staffPermission.findMany({
        orderBy: [{ group: 'asc' }, { label: 'asc' }],
      }),
    ]);

    const grouped = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const group = grouped.get(permission.group) ?? [];
      group.push(permission);
      grouped.set(permission.group, group);
    }

    return {
      roles: roles.map((role) => {
        const permissionKeys = role.permissions.map(
          ({ permission }) => permission.key,
        );
        return {
          id: role.id,
          name: role.name,
          slug: role.slug,
          description: role.description,
          color: role.color,
          position: role.position,
          permissionKeys,
          memberCount: role._count.members,
          manageable: this.accessService.canManageRole(
            access,
            role.position,
            permissionKeys,
          ),
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
        };
      }),
      permissionGroups: [...grouped.entries()].map(
        ([group, groupPermissions]) => ({
          group,
          permissions: groupPermissions.map((permission) => ({
            id: permission.id,
            key: permission.key,
            label: permission.label,
            group: permission.group,
            description: permission.description,
          })),
        }),
      ),
    };
  }

  async listStaff(
    query: z.infer<typeof staffMembersQuerySchema>,
    access: StaffAccessSnapshot,
  ) {
    const where: Prisma.UserWhereInput = {
      role: { in: ['OWNER', 'STAFF'] },
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [members, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [
          { role: 'asc' },
          { createdAt: query.direction },
          { id: query.direction },
        ],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lifecycleStatus: true,
          banned: true,
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: true,
          staffMembership: {
            select: { status: true, statusReason: true },
          },
          staffRoleAssignments: {
            select: {
              role: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  position: true,
                  permissions: {
                    select: { permission: { select: { key: true } } },
                  },
                },
              },
            },
            orderBy: { role: { position: 'desc' } },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: members.map((member) => {
        const assignedRoles = member.staffRoleAssignments.map(
          ({ role }) => role,
        );
        const rolePermissionKeys = [
          ...new Set(
            assignedRoles.flatMap(({ permissions }) =>
              permissions.map(({ permission }) => permission.key),
            ),
          ),
        ];
        const roles = assignedRoles.map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
        }));
        const highestRolePosition =
          member.role === 'OWNER'
            ? Number.MAX_SAFE_INTEGER
            : Math.max(0, ...roles.map(({ position }) => position));
        return {
          id: member.id,
          name: member.name,
          email: member.email,
          accountType: member.role,
          lifecycleStatus: member.lifecycleStatus,
          banned: member.banned,
          emailVerified: member.emailVerified,
          twoFactorEnabled: member.twoFactorEnabled,
          membershipStatus:
            member.role === 'OWNER'
              ? null
              : (member.staffMembership?.status ?? 'REVOKED'),
          membershipReason: member.staffMembership?.statusReason ?? null,
          roleIds: roles.map(({ id }) => id),
          roles,
          highestRolePosition,
          manageable:
            member.role === 'STAFF' &&
            member.id !== access.userId &&
            this.accessService.canManageRole(
              access,
              highestRolePosition,
              rolePermissionKeys,
            ),
          createdAt: member.createdAt.toISOString(),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
      pageCount: Math.ceil(total / query.pageSize),
    };
  }

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

  async createRole(
    actorId: string,
    access: StaffAccessSnapshot,
    input: z.infer<typeof createStaffRoleSchema>,
  ) {
    this.assertRolePositionManageable(access, input.position);
    this.assertGrantablePermissions(access, input.permissionKeys);
    const slug = await this.uniqueSlug(input.name);

    return prisma.$transaction(async (tx) => {
      const permissionIds = await this.permissionIds(tx, input.permissionKeys);
      const role = await tx.staffRole.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
          color: input.color,
          position: input.position,
          createdById: actorId,
          updatedById: actorId,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ROLE_CREATED',
          entityType: 'StaffRole',
          entityId: role.id,
          after: { ...input, slug },
        },
      });
      return { id: role.id };
    });
  }

  async updateRole(
    actorId: string,
    access: StaffAccessSnapshot,
    roleId: string,
    input: z.infer<typeof updateStaffRoleSchema>,
  ) {
    const role = await this.requireManageableRole(access, roleId);
    this.assertRolePositionManageable(access, input.position);
    const duplicate = await prisma.staffRole.findFirst({
      where: {
        name: { equals: input.name, mode: 'insensitive' },
        id: { not: roleId },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'STAFF_ROLE_NAME_EXISTS',
        message: 'A staff role with this name already exists.',
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.staffRole.update({
        where: { id: roleId },
        data: {
          name: input.name,
          description: input.description ?? null,
          color: input.color,
          position: input.position,
          updatedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ROLE_UPDATED',
          entityType: 'StaffRole',
          entityId: roleId,
          before: {
            name: role.name,
            description: role.description,
            color: role.color,
            position: role.position,
          },
          after: input,
        },
      });
      return result;
    });
    return { id: updated.id };
  }

  async setRolePermissions(
    actorId: string,
    access: StaffAccessSnapshot,
    roleId: string,
    permissionKeys: string[],
  ) {
    const role = await this.requireManageableRole(access, roleId);
    this.assertGrantablePermissions(access, permissionKeys);
    const normalizedKeys = [...new Set(permissionKeys)].sort();

    await prisma.$transaction(async (tx) => {
      const before = await tx.staffRolePermission.findMany({
        where: { roleId },
        select: { permission: { select: { key: true } } },
      });
      const permissionIds = await this.permissionIds(tx, normalizedKeys);
      await tx.staffRolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.staffRolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      await tx.staffRole.update({
        where: { id: roleId },
        data: { updatedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ROLE_PERMISSIONS_UPDATED',
          entityType: 'StaffRole',
          entityId: roleId,
          before: {
            permissionKeys: before
              .map(({ permission }) => permission.key)
              .sort(),
          },
          after: { permissionKeys: normalizedKeys },
        },
      });
    });
    return { id: role.id };
  }

  async deleteRole(
    actorId: string,
    access: StaffAccessSnapshot,
    roleId: string,
  ) {
    const role = await this.requireManageableRole(access, roleId);
    const memberCount = await prisma.staffUserRole.count({ where: { roleId } });
    if (memberCount > 0) {
      throw new ConflictException({
        code: 'STAFF_ROLE_IN_USE',
        message: 'Remove this role from every staff member before deleting it.',
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.staffRole.delete({ where: { id: roleId } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ROLE_DELETED',
          entityType: 'StaffRole',
          entityId: roleId,
          before: { name: role.name, slug: role.slug, position: role.position },
        },
      });
    });
    return { id: roleId };
  }

  async createStaffMember(
    actorId: string,
    access: StaffAccessSnapshot,
    input: z.infer<typeof createStaffMemberSchema>,
  ) {
    if (input.userId === actorId) {
      throw new ConflictException({
        code: 'SELF_STAFF_CHANGE_BLOCKED',
        message: 'You cannot change your own staff membership.',
      });
    }
    const roles = await prisma.staffRole.findMany({
      where: { id: { in: [...new Set(input.roleIds)] } },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (roles.length !== new Set(input.roleIds).size)
      throw new NotFoundException('One or more staff roles were not found.');
    for (const role of roles) {
      this.assertRoleManageable(
        access,
        role.position,
        role.permissions.map(({ permission }) => permission.key),
      );
    }

    return prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true, role: true, banned: true, lifecycleStatus: true },
      });
      if (!target) throw new NotFoundException();
      if (target.role !== 'USER') {
        throw new ConflictException({
          code: 'ACCOUNT_TYPE_CONFLICT',
          message: 'Only customer accounts can be promoted to staff.',
        });
      }
      if (target.banned || target.lifecycleStatus !== 'ACTIVE') {
        throw new ConflictException({
          code: 'ACCOUNT_INACTIVE',
          message: 'Only an active account can become staff.',
        });
      }

      await tx.user.update({
        where: { id: target.id },
        data: { role: 'STAFF' },
      });
      await tx.staffMembership.upsert({
        where: { userId: target.id },
        update: {
          status: 'ACTIVE',
          managedById: actorId,
          statusReason: null,
          activatedAt: new Date(),
          suspendedAt: null,
          revokedAt: null,
        },
        create: {
          userId: target.id,
          status: 'ACTIVE',
          managedById: actorId,
          activatedAt: new Date(),
        },
      });
      await tx.staffUserRole.createMany({
        data: roles.map((role) => ({
          userId: target.id,
          roleId: role.id,
          grantedById: actorId,
        })),
        skipDuplicates: true,
      });
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_MEMBER_CREATED',
          entityType: 'User',
          entityId: target.id,
          before: { accountType: target.role },
          after: { accountType: 'STAFF', roleIds: roles.map(({ id }) => id) },
        },
      });
      return { id: target.id, accountType: 'STAFF' as const };
    });
  }

  async assignRole(
    actorId: string,
    access: StaffAccessSnapshot,
    userId: string,
    roleId: string,
  ) {
    if (userId === actorId)
      throw new ConflictException({
        code: 'SELF_STAFF_CHANGE_BLOCKED',
        message: 'You cannot change your own roles.',
      });
    const role = await this.requireManageableRole(access, roleId);
    await this.requireManageableStaffTarget(access, userId);
    await prisma.$transaction(async (tx) => {
      await tx.staffUserRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        update: {},
        create: { userId, roleId, grantedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ROLE_ASSIGNED',
          entityType: 'User',
          entityId: userId,
          after: { roleId, roleName: role.name },
        },
      });
    });
    return { userId, roleId };
  }

  async removeRole(
    actorId: string,
    access: StaffAccessSnapshot,
    userId: string,
    roleId: string,
  ) {
    if (userId === actorId)
      throw new ConflictException({
        code: 'SELF_STAFF_CHANGE_BLOCKED',
        message: 'You cannot change your own roles.',
      });
    const role = await this.requireManageableRole(access, roleId);
    await this.requireManageableStaffTarget(access, userId);
    await prisma.$transaction(
      async (tx) => {
        const assignmentCount = await tx.staffUserRole.count({
          where: { userId },
        });
        if (assignmentCount <= 1) {
          throw new ConflictException({
            code: 'STAFF_LAST_ROLE',
            message:
              'A staff member must keep at least one role. Revoke staff access instead.',
          });
        }
        const deleted = await tx.staffUserRole.deleteMany({
          where: { userId, roleId },
        });
        if (deleted.count === 0) throw new NotFoundException();
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'STAFF_ROLE_REMOVED',
            entityType: 'User',
            entityId: userId,
            before: { roleId, roleName: role.name },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { userId, roleId };
  }

  async setStaffRoles(
    actorId: string,
    access: StaffAccessSnapshot,
    userId: string,
    roleIds: string[],
  ) {
    if (userId === actorId) {
      throw new ConflictException({
        code: 'SELF_STAFF_CHANGE_BLOCKED',
        message: 'You cannot change your own roles.',
      });
    }
    await this.requireManageableStaffTarget(access, userId);
    const uniqueRoleIds = [...new Set(roleIds)];
    const roles = await prisma.staffRole.findMany({
      where: { id: { in: uniqueRoleIds } },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (roles.length !== uniqueRoleIds.length)
      throw new NotFoundException('One or more staff roles were not found.');
    for (const role of roles) {
      this.assertRoleManageable(
        access,
        role.position,
        role.permissions.map(({ permission }) => permission.key),
      );
    }

    await prisma.$transaction(
      async (tx) => {
        const before = await tx.staffUserRole.findMany({
          where: { userId },
          select: { roleId: true },
        });
        const previousIds = before.map(({ roleId }) => roleId);
        const added = uniqueRoleIds.filter(
          (roleId) => !previousIds.includes(roleId),
        );
        const removed = previousIds.filter(
          (roleId) => !uniqueRoleIds.includes(roleId),
        );
        await tx.staffUserRole.deleteMany({
          where: { userId, roleId: { notIn: uniqueRoleIds } },
        });
        await tx.staffUserRole.createMany({
          data: added.map((roleId) => ({
            userId,
            roleId,
            grantedById: actorId,
          })),
          skipDuplicates: true,
        });
        if (added.length > 0)
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'STAFF_ROLE_ASSIGNED',
              entityType: 'User',
              entityId: userId,
              after: { roleIds: added },
            },
          });
        if (removed.length > 0)
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'STAFF_ROLE_REMOVED',
              entityType: 'User',
              entityId: userId,
              before: { roleIds: removed },
            },
          });
      },
      { isolationLevel: 'Serializable' },
    );
    return { userId, roleIds: uniqueRoleIds };
  }

  async setStaffStatus(
    actorId: string,
    access: StaffAccessSnapshot,
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason?: string | null,
  ) {
    if (userId === actorId) {
      throw new ConflictException({
        code: 'SELF_STAFF_CHANGE_BLOCKED',
        message: 'You cannot change your own staff status.',
      });
    }
    await this.requireManageableStaffTarget(access, userId);
    const now = new Date();
    await prisma.$transaction(
      async (tx) => {
        const membership = await tx.staffMembership.findUnique({
          where: { userId },
          select: { status: true, statusReason: true },
        });
        if (!membership) {
          throw new ConflictException({
            code: 'STAFF_MEMBERSHIP_MISSING',
            message: 'The staff membership record is missing.',
          });
        }
        const statusReason = status === 'SUSPENDED' ? (reason ?? null) : null;
        await tx.staffMembership.update({
          where: { userId },
          data: {
            status,
            managedById: actorId,
            statusReason,
            ...(status === 'ACTIVE' ? { activatedAt: now } : {}),
            suspendedAt: status === 'SUSPENDED' ? now : null,
            revokedAt: null,
          },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'STAFF_STATUS_CHANGED',
            entityType: 'StaffMembership',
            entityId: userId,
            reason: statusReason,
            before: {
              status: membership.status,
              reason: membership.statusReason,
            },
            after: { status, reason: statusReason },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { userId, status };
  }

  async revokeStaffMember(
    actorId: string,
    access: StaffAccessSnapshot,
    userId: string,
  ) {
    if (userId === actorId) {
      throw new ConflictException({
        code: 'SELF_STAFF_CHANGE_BLOCKED',
        message: 'You cannot revoke your own staff access.',
      });
    }
    await this.requireManageableStaffTarget(access, userId);
    await prisma.$transaction(
      async (tx) => {
        const roleIds = (
          await tx.staffUserRole.findMany({
            where: { userId },
            select: { roleId: true },
          })
        ).map(({ roleId }) => roleId);
        await tx.staffUserRole.deleteMany({ where: { userId } });
        await tx.staffMembership.upsert({
          where: { userId },
          update: {
            status: 'REVOKED',
            managedById: actorId,
            statusReason: 'Staff access revoked',
            revokedAt: new Date(),
            suspendedAt: null,
          },
          create: {
            userId,
            status: 'REVOKED',
            managedById: actorId,
            statusReason: 'Staff access revoked',
            revokedAt: new Date(),
          },
        });
        const changed = await tx.user.updateMany({
          where: { id: userId, role: 'STAFF' },
          data: { role: 'USER' },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Staff membership changed while it was being revoked.',
          );
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'ACCOUNT_TYPE_CHANGED',
            entityType: 'User',
            entityId: userId,
            before: { accountType: 'STAFF', roleIds },
            after: { accountType: 'USER', roleIds: [] },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { id: userId, accountType: 'USER' as const };
  }

  private assertRolePositionManageable(
    access: StaffAccessSnapshot,
    position: number,
  ) {
    if (!this.accessService.canManageRole(access, position)) {
      throw new ForbiddenException({
        code: 'STAFF_ROLE_HIERARCHY',
        message: 'You can manage only roles below your highest role.',
      });
    }
  }

  private assertRoleManageable(
    access: StaffAccessSnapshot,
    position: number,
    permissionKeys: readonly string[],
  ) {
    if (!this.accessService.canManageRole(access, position, permissionKeys)) {
      throw new ForbiddenException({
        code: 'STAFF_ROLE_HIERARCHY',
        message:
          'You can manage only lower roles whose permissions you already hold.',
      });
    }
  }

  private assertGrantablePermissions(
    access: StaffAccessSnapshot,
    permissionKeys: string[],
  ) {
    const unknown = permissionKeys.filter(
      (key) => !isRegisteredStaffPermission(key),
    );
    if (unknown.length > 0) {
      throw new BadRequestException({
        code: 'UNKNOWN_STAFF_PERMISSION',
        message: 'One or more permission keys are not registered.',
        unknown,
      });
    }
    if (access.accountType === 'STAFF') {
      const unheld = permissionKeys.filter(
        (key) => !access.permissions.has(key),
      );
      if (unheld.length > 0) {
        throw new ForbiddenException({
          code: 'STAFF_PERMISSION_ESCALATION',
          message: 'Staff cannot grant permissions they do not hold.',
          unheld,
        });
      }
    }
  }

  private async requireManageableRole(
    access: StaffAccessSnapshot,
    roleId: string,
  ) {
    const role = await prisma.staffRole.findUnique({
      where: { id: roleId },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role) throw new NotFoundException();
    this.assertRoleManageable(
      access,
      role.position,
      role.permissions.map(({ permission }) => permission.key),
    );
    return role;
  }

  private async requireManageableStaffTarget(
    access: StaffAccessSnapshot,
    userId: string,
  ) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        staffRoleAssignments: {
          select: {
            role: {
              select: {
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
    if (!target || target.role !== 'STAFF') throw new NotFoundException();
    const highest = Math.max(
      0,
      ...target.staffRoleAssignments.map(({ role }) => role.position),
    );
    const permissionKeys = [
      ...new Set(
        target.staffRoleAssignments.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.key),
        ),
      ),
    ];
    this.assertRoleManageable(access, highest, permissionKeys);
  }

  private async permissionIds(tx: Prisma.TransactionClient, keys: string[]) {
    if (keys.length === 0) return [];
    const permissions = await tx.staffPermission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    if (permissions.length !== new Set(keys).size) {
      throw new BadRequestException({
        code: 'UNKNOWN_STAFF_PERMISSION',
        message: 'One or more permission keys are not synchronized.',
      });
    }
    return permissions.map(({ id }) => id);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'staff-role';
    for (let suffix = 0; suffix < 100; suffix += 1) {
      const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const exists = await prisma.staffRole.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!exists) return slug;
    }
    throw new ConflictException({
      code: 'STAFF_ROLE_SLUG_EXHAUSTED',
      message: 'Could not create a unique role identifier.',
    });
  }
}
