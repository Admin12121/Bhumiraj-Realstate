import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
  sessionCreatedAt: Date | null;
}>;

// Authorization stays database-derived, so revocation still takes effect
// without waiting for a session to expire. This window only bounds how long a
// sibling instance can serve a stale snapshot; the mutating instance clears its
// own entry immediately through invalidate().
const ACCESS_CACHE_TTL_MS = 5_000;
const ACCESS_CACHE_MAX_ENTRIES = 5_000;

type CacheEntry = { snapshot: StaffAccessSnapshot | null; expiresAt: number };

@Injectable()
export class StaffAccessService implements OnModuleInit {
  private readonly logger = new Logger(StaffAccessService.name);
  private readonly cache = new Map<string, CacheEntry>();

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
    // Only a real session identifies a cache entry; without one the snapshot
    // carries no step-up context and is not worth keying on.
    if (!sessionId) return this.load(userId, sessionId);

    const cacheKey = `${userId}:${sessionId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

    const snapshot = await this.load(userId, sessionId);
    this.remember(cacheKey, snapshot);
    return snapshot;
  }

  /** Drops cached snapshots after a privilege change on this instance. */
  invalidate(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) this.cache.delete(key);
    }
  }

  /** Used when a role changes and every holder's effective grants shift. */
  invalidateAll(): void {
    this.cache.clear();
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

  private async load(
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
          ? {
              where: { id: sessionId },
              take: 1,
              select: { authMethod: true, createdAt: true },
            }
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

    const session = Array.isArray(user.sessions) ? user.sessions[0] : undefined;
    const authMethod = session?.authMethod ?? null;
    if (sessionId && (authMethod === null || authMethod === 'unknown')) {
      // Every staff session lands here when the sign-in hook stops classifying
      // a Better Auth route, which locks the whole admin surface at once.
      this.logger.warn(
        `Session ${sessionId} for staff user ${userId} has no classified authMethod; staff step-up will be refused.`,
      );
    }

    return {
      userId: user.id,
      accountType: user.role,
      permissions,
      roleIds: roles.map(({ id }) => id),
      highestRolePosition:
        user.role === 'OWNER'
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, ...roles.map(({ position }) => position)),
      authMethod,
      sessionCreatedAt: session?.createdAt ?? null,
    };
  }

  private remember(key: string, snapshot: StaffAccessSnapshot | null): void {
    if (this.cache.size >= ACCESS_CACHE_MAX_ENTRIES) {
      const now = Date.now();
      for (const [entryKey, entry] of this.cache) {
        if (entry.expiresAt <= now) this.cache.delete(entryKey);
      }
      if (this.cache.size >= ACCESS_CACHE_MAX_ENTRIES) this.cache.clear();
    }
    this.cache.set(key, { snapshot, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
  }
}
