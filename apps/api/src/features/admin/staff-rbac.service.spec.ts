import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { prisma } from '@real-estate/database';
import '../../features/admin/admin.permissions';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from '../../shared/auth/staff-access.service';
import { StaffRbacService } from './staff-rbac.service';

jest.mock('@real-estate/database', () => ({
  prisma: {
    $transaction: jest.fn(),
    staffRole: { findUnique: jest.fn(), findFirst: jest.fn() },
    staffUserRole: { count: jest.fn() },
    platformInvitationStaffRole: { count: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));

type DatabaseMock = {
  $transaction: jest.Mock;
  staffRole: { findUnique: jest.Mock; findFirst: jest.Mock };
  staffUserRole: { count: jest.Mock };
  platformInvitationStaffRole: { count: jest.Mock };
  user: { findUnique: jest.Mock };
};
const database = prisma as unknown as DatabaseMock;

const staffAccess: StaffAccessSnapshot = {
  userId: 'staff-1',
  accountType: 'STAFF',
  permissions: new Set(['admin.roles.manage', 'admin.staff.manage']),
  roleIds: ['role-1'],
  highestRolePosition: 50,
  authMethod: 'passkey',
  sessionCreatedAt: new Date(),
};

function roleRow(position: number, permissionKeys: string[]) {
  return {
    id: 'role-target',
    name: 'Target',
    slug: 'target',
    position,
    permissions: permissionKeys.map((key) => ({ permission: { key } })),
  };
}

describe('StaffRbacService escalation boundaries', () => {
  const accessService = new StaffAccessService();
  const service = new StaffRbacService(accessService);

  beforeEach(() => {
    jest.clearAllMocks();
    database.staffRole.findFirst.mockResolvedValue(null);
  });

  it('refuses to grant a permission the actor does not hold', async () => {
    await expect(
      service.createRole('staff-1', staffAccess, {
        name: 'Auditor',
        description: null,
        color: '#64748b',
        position: 10,
        permissionKeys: ['admin.settings.manage'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses unregistered permission keys outright', async () => {
    await expect(
      service.createRole('staff-1', staffAccess, {
        name: 'Auditor',
        description: null,
        color: '#64748b',
        position: 10,
        permissionKeys: ['admin.invented.manage'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to create a role at or above the actor position', async () => {
    await expect(
      service.createRole('staff-1', staffAccess, {
        name: 'Peer',
        description: null,
        color: '#64748b',
        position: 50,
        permissionKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a duplicate role name on creation, matching the update rule', async () => {
    database.staffRole.findFirst.mockResolvedValue({ id: 'role-existing' });
    await expect(
      service.createRole('staff-1', staffAccess, {
        name: 'Moderator',
        description: null,
        color: '#64748b',
        position: 10,
        permissionKeys: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to edit a role holding permissions the actor lacks', async () => {
    database.staffRole.findUnique.mockResolvedValue(
      roleRow(10, ['admin.settings.manage']),
    );
    await expect(
      service.updateRole('staff-1', staffAccess, 'role-target', {
        name: 'Target',
        description: null,
        color: '#64748b',
        position: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks deleting a role that a pending invitation still references', async () => {
    database.staffRole.findUnique.mockResolvedValue(roleRow(10, []));
    database.$transaction.mockResolvedValue([0, 1]);
    await expect(
      service.deleteRole('staff-1', staffAccess, 'role-target'),
    ).rejects.toMatchObject({
      response: { code: 'STAFF_ROLE_INVITED' },
    });
  });

  it('blocks deleting a role that staff members still hold', async () => {
    database.staffRole.findUnique.mockResolvedValue(roleRow(10, []));
    database.$transaction.mockResolvedValue([2, 0]);
    await expect(
      service.deleteRole('staff-1', staffAccess, 'role-target'),
    ).rejects.toMatchObject({
      response: { code: 'STAFF_ROLE_IN_USE' },
    });
  });

  it('refuses every self-directed staff change', async () => {
    await expect(
      service.assignRole('staff-1', staffAccess, 'staff-1', 'role-target'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.removeRole('staff-1', staffAccess, 'staff-1', 'role-target'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.setStaffRoles('staff-1', staffAccess, 'staff-1', ['role-target']),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.setStaffStatus('staff-1', staffAccess, 'staff-1', 'SUSPENDED'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.revokeStaffMember('staff-1', staffAccess, 'staff-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to manage a staff member who outranks the actor', async () => {
    database.staffRole.findUnique.mockResolvedValue(roleRow(10, []));
    database.user.findUnique.mockResolvedValue({
      role: 'STAFF',
      staffRoleAssignments: [{ role: { position: 90, permissions: [] } }],
    });
    await expect(
      service.assignRole('staff-1', staffAccess, 'staff-2', 'role-target'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to manage the owner through staff endpoints', async () => {
    database.staffRole.findUnique.mockResolvedValue(roleRow(10, []));
    database.user.findUnique.mockResolvedValue({
      role: 'OWNER',
      staffRoleAssignments: [],
    });
    await expect(
      service.assignRole('staff-1', staffAccess, 'owner-1', 'role-target'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the owner manage any role regardless of hierarchy', () => {
    const owner: StaffAccessSnapshot = {
      ...staffAccess,
      accountType: 'OWNER',
      permissions: new Set(),
      highestRolePosition: Number.MAX_SAFE_INTEGER,
    };
    expect(
      accessService.canManageRole(owner, 999, ['admin.settings.manage']),
    ).toBe(true);
  });
});
