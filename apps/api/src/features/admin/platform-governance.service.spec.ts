import { ForbiddenException } from '@nestjs/common';
import { prisma } from '@real-estate/database';
import type { StaffAccessSnapshot } from '../../shared/auth/staff-access.service';
import { PlatformGovernanceService } from './platform-governance.service';

jest.mock('../../bootstrap-env', () => ({
  apiEnv: {
    APP_URL: 'http://localhost:3000',
    RESEND_API_KEY: undefined,
    MAIL_FROM: 'test@example.com',
  },
}));
jest.mock('@real-estate/database', () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock('@real-estate/email', () => ({ sendResendEmail: jest.fn() }));

const staffAccess: StaffAccessSnapshot = {
  userId: 'staff-1',
  accountType: 'STAFF',
  permissions: new Set(['admin.staff.manage']),
  roleIds: ['role-1'],
  highestRolePosition: 50,
  authMethod: 'passkey',
};

describe('PlatformGovernanceService owner boundary', () => {
  const service = new PlatformGovernanceService({} as never);

  afterEach(() => jest.clearAllMocks());

  it('rejects owner transfer even for privileged staff', async () => {
    await expect(
      service.transferOwnership('staff-1', staffAccess, {
        targetUserId: 'staff-2',
        previousOwnerRoleIds: ['role-1'],
        confirmation: 'TRANSFER OWNERSHIP',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('atomically demotes the old owner, promotes eligible staff, and closes sessions', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ lock_result: '' }]),
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ role: 'OWNER', email: 'owner@test.local' })
          .mockResolvedValueOnce({
            role: 'STAFF',
            email: 'next-owner@test.local',
            emailVerified: true,
            twoFactorEnabled: true,
            banned: false,
            lifecycleStatus: 'ACTIVE',
            staffMembership: { status: 'ACTIVE' },
            staffRoleAssignments: [{ roleId: 'target-role' }],
          }),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({}),
      },
      staffRole: {
        findMany: jest.fn().mockResolvedValue([{ id: 'fallback-role' }]),
      },
      staffMembership: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      staffUserRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      (operation: (client: typeof tx) => unknown) =>
        Promise.resolve(operation(tx)),
    );
    const owner = { ...staffAccess, accountType: 'OWNER' as const };

    await expect(
      service.transferOwnership('owner-1', owner, {
        targetUserId: 'staff-2',
        previousOwnerRoleIds: ['fallback-role'],
        confirmation: 'TRANSFER OWNERSHIP',
      }),
    ).resolves.toEqual({
      ownerId: 'staff-2',
      previousOwnerId: 'owner-1',
      requiresSignIn: true,
    });
    expect(tx.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'owner-1' },
      data: { role: 'STAFF' },
    });
    expect(tx.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'staff-2' },
      data: { role: 'OWNER' },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ['owner-1', 'staff-2'] } },
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
