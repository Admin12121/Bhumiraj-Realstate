import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { prisma } from '@real-estate/database';
import '../../features/admin/admin.permissions';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from './staff-access.service';
import {
  StaffPermissionsGuard,
  type StaffAuthorizedRequest,
} from './staff-permissions.guard';

jest.mock('../../bootstrap-env', () => ({ apiEnv: { E2E_MODE: false } }));
jest.mock('@real-estate/database', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

const staffAccess: StaffAccessSnapshot = {
  userId: 'staff-1',
  accountType: 'STAFF',
  permissions: new Set(['admin.users.read']),
  roleIds: ['role-1'],
  highestRolePosition: 50,
  authMethod: 'passkey',
};

function contextFor(request: StaffAuthorizedRequest): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardFor(required: string[], resolved: StaffAccessSnapshot | null) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  const accessService = {
    resolve: jest.fn().mockResolvedValue(resolved),
    hasPermission: jest.fn(
      (access: StaffAccessSnapshot, permission: string) =>
        access.accountType === 'OWNER' || access.permissions.has(permission),
    ),
  } as unknown as StaffAccessService;
  return new StaffPermissionsGuard(reflector, accessService);
}

describe('StaffPermissionsGuard', () => {
  it('rejects requests without an authenticated session', async () => {
    await expect(
      guardFor([], null).canActivate(contextFor({})),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects non-staff accounts', async () => {
    const request = {
      session: { user: { id: 'user-1' }, session: { id: 'session-1' } },
    };
    await expect(
      guardFor([], null).canActivate(contextFor(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires strong authentication for staff access', async () => {
    const request = {
      session: { user: { id: 'staff-1' }, session: { id: 'session-1' } },
    };
    await expect(
      guardFor([], { ...staffAccess, authMethod: 'credential' }).canActivate(
        contextFor(request),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a missing registered permission', async () => {
    const request = {
      session: { user: { id: 'staff-1' }, session: { id: 'session-1' } },
    };
    await expect(
      guardFor(['admin.settings.manage'], staffAccess).canActivate(
        contextFor(request),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches access after all checks pass', async () => {
    const request: StaffAuthorizedRequest = {
      session: { user: { id: 'staff-1' }, session: { id: 'session-1' } },
    };
    await expect(
      guardFor(['admin.users.read'], staffAccess).canActivate(
        contextFor(request),
      ),
    ).resolves.toBe(true);
    expect(request.staffAccess).toBe(staffAccess);
  });
});

describe('StaffAccessService hierarchy', () => {
  const service = new StaffAccessService();

  afterEach(() => jest.clearAllMocks());

  it('lets owner bypass registered permissions but rejects injected keys', () => {
    const owner = {
      ...staffAccess,
      accountType: 'OWNER' as const,
      permissions: new Set<string>(),
    };
    expect(service.hasPermission(owner, 'admin.settings.manage')).toBe(true);
    expect(service.hasPermission(owner, 'admin.injected.manage')).toBe(false);
  });

  it('requires both lower position and a permission subset for staff role management', () => {
    expect(service.canManageRole(staffAccess, 40, ['admin.users.read'])).toBe(
      true,
    );
    expect(service.canManageRole(staffAccess, 50, ['admin.users.read'])).toBe(
      false,
    );
    expect(
      service.canManageRole(staffAccess, 40, ['admin.settings.manage']),
    ).toBe(false);
  });

  it('denies suspended staff even when role permissions are still assigned', async () => {
    const databaseMock = prisma as unknown as {
      user: { findUnique: jest.Mock };
    };
    databaseMock.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      role: 'STAFF',
      banned: false,
      lifecycleStatus: 'ACTIVE',
      staffMembership: { status: 'SUSPENDED' },
      sessions: [],
      staffRoleAssignments: [
        {
          role: {
            id: 'role-1',
            position: 50,
            permissions: [{ permission: { key: 'admin.users.read' } }],
          },
        },
      ],
    });

    await expect(service.resolve('staff-1')).resolves.toBeNull();
  });

  it('resolves active staff from database-owned membership and grants', async () => {
    const databaseMock = prisma as unknown as {
      user: { findUnique: jest.Mock };
    };
    databaseMock.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      role: 'STAFF',
      banned: false,
      lifecycleStatus: 'ACTIVE',
      staffMembership: { status: 'ACTIVE' },
      sessions: [],
      staffRoleAssignments: [
        {
          role: {
            id: 'role-1',
            position: 50,
            permissions: [{ permission: { key: 'admin.users.read' } }],
          },
        },
      ],
    });

    await expect(service.resolve('staff-1')).resolves.toMatchObject({
      accountType: 'STAFF',
      roleIds: ['role-1'],
      highestRolePosition: 50,
    });
  });
});
