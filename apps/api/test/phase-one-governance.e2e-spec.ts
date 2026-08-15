import { ForbiddenException } from '@nestjs/common';
import { prisma } from '@real-estate/database';
import { AgentGovernanceService } from '../src/features/admin/agent-governance.service';
import { ADMIN_PERMISSIONS } from '../src/features/admin/admin.permissions';
import { PlatformGovernanceService } from '../src/features/admin/platform-governance.service';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from '../src/shared/auth/staff-access.service';

describe('Phase 1 governance (database)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const accessService = new StaffAccessService();
  const platformService = new PlatformGovernanceService(accessService);
  const agentService = new AgentGovernanceService();
  let actorId = '';
  let roleId = '';
  const createdUserIds: string[] = [];

  const ownerAccess = (): StaffAccessSnapshot => ({
    userId: actorId,
    accountType: 'OWNER',
    permissions: new Set(),
    roleIds: [],
    highestRolePosition: Number.MAX_SAFE_INTEGER,
    authMethod: 'passkey',
  });

  beforeAll(async () => {
    const permission = await prisma.staffPermission.upsert({
      where: { key: ADMIN_PERMISSIONS.STAFF_READ },
      update: {
        label: 'View staff',
        group: 'Staff',
        description: 'View staff members and their assigned roles.',
      },
      create: {
        key: ADMIN_PERMISSIONS.STAFF_READ,
        label: 'View staff',
        group: 'Staff',
        description: 'View staff members and their assigned roles.',
      },
    });
    const role = await prisma.staffRole.create({
      data: {
        name: `Phase 1 reviewer ${suffix}`,
        slug: `phase-1-reviewer-${suffix}`,
        description: 'Disposable Phase 1 integration role',
        position: 10,
        permissions: { create: { permissionId: permission.id } },
      },
    });
    roleId = role.id;
    const actor = await prisma.user.create({
      data: {
        name: 'Phase 1 test administrator',
        email: `phase1-admin-${suffix}@test.local`,
        emailVerified: true,
        role: 'STAFF',
        staffMembership: {
          create: { status: 'ACTIVE', activatedAt: new Date() },
        },
      },
    });
    actorId = actor.id;
    createdUserIds.push(actor.id);
  });

  afterAll(async () => {
    await prisma.platformInvitation.deleteMany({
      where: { invitedById: actorId },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    if (roleId) await prisma.staffRole.delete({ where: { id: roleId } });
  });

  it('binds staff invitations to the verified recipient and membership state', async () => {
    const invitedEmail = `phase1-invite-${suffix}@test.local`;
    const invitee = await prisma.user.create({
      data: {
        name: 'Invited staff member',
        email: invitedEmail,
        emailVerified: true,
      },
    });
    const wrongUser = await prisma.user.create({
      data: {
        name: 'Wrong invitation recipient',
        email: `phase1-wrong-${suffix}@test.local`,
        emailVerified: true,
      },
    });
    createdUserIds.push(invitee.id, wrongUser.id);

    const invitation = await platformService.createInvitation(
      actorId,
      ownerAccess(),
      { email: invitedEmail, type: 'STAFF', roleIds: [roleId] },
    );
    const token = new URL(invitation.inviteLink).searchParams.get('token');
    expect(token).toBeTruthy();

    await expect(
      platformService.acceptInvitation(wrongUser.id, token!),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      platformService.acceptInvitation(invitee.id, token!),
    ).resolves.toMatchObject({ accountType: 'STAFF', requiresSignIn: true });

    const active = await accessService.resolve(invitee.id);
    expect(active?.accountType).toBe('STAFF');
    expect(active?.permissions.has(ADMIN_PERMISSIONS.STAFF_READ)).toBe(true);

    await prisma.staffMembership.update({
      where: { userId: invitee.id },
      data: { status: 'SUSPENDED', suspendedAt: new Date() },
    });
    await expect(accessService.resolve(invitee.id)).resolves.toBeNull();
  });

  it('keeps agent lifecycle separate and makes retirement terminal', async () => {
    const customer = await prisma.user.create({
      data: {
        name: 'Phase 1 agent candidate',
        email: `phase1-agent-${suffix}@test.local`,
        emailVerified: true,
      },
    });
    createdUserIds.push(customer.id);

    const created = await agentService.createAgent(actorId, customer.id);
    expect(created.status).toBe('PENDING');

    await expect(
      agentService.setStatus(actorId, created.id, 'ACTIVE'),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(
      agentService.setAvailability(actorId, created.id, 'AVAILABLE', 25),
    ).resolves.toMatchObject({
      availabilityStatus: 'AVAILABLE',
      maxActiveCases: 25,
    });
    await expect(
      agentService.setStatus(
        actorId,
        created.id,
        'RETIRED',
        'Integration lifecycle completed',
      ),
    ).resolves.toMatchObject({ status: 'RETIRED' });

    const retired = await prisma.user.findUniqueOrThrow({
      where: { id: customer.id },
      select: { role: true, agentProfile: { select: { status: true } } },
    });
    expect(retired).toEqual({
      role: 'USER',
      agentProfile: { status: 'RETIRED' },
    });
    await expect(
      agentService.setStatus(actorId, created.id, 'ACTIVE'),
    ).rejects.toMatchObject({ response: { code: 'AGENT_RETIRED_TERMINAL' } });
  });
});
