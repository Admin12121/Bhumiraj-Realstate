import { prisma } from '@real-estate/database';
import { ANONYMOUS_THREAD_TTL_MINUTES } from '@real-estate/contracts';
import { SupportService } from '../src/features/support/support.service';

/**
 * Anonymous identity, thread adoption on sign-in, and the retention promise:
 * an unattended guest thread is erased outright once its window closes.
 */
describe('Support chat (database)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const service = new SupportService();

  let staffId = '';
  let visitorUserId = '';
  const visitorKeys: string[] = [];

  beforeAll(async () => {
    const staff = await prisma.user.create({
      data: {
        name: `support-staff ${suffix}`,
        email: `support-staff-${suffix}@example.test`,
        emailVerified: true,
      },
      select: { id: true },
    });
    staffId = staff.id;

    const visitor = await prisma.user.create({
      data: {
        name: `visitor ${suffix}`,
        email: `visitor-${suffix}@example.test`,
        emailVerified: true,
      },
      select: { id: true },
    });
    visitorUserId = visitor.id;
  });

  afterAll(async () => {
    await prisma.supportThread.deleteMany({
      where: {
        OR: [
          { visitorKey: { in: visitorKeys } },
          { userId: { in: [visitorUserId, staffId] } },
        ],
      },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: staffId } });
    await prisma.user.deleteMany({
      where: { id: { in: [staffId, visitorUserId] } },
    });
  });

  it('gives two different visitor keys two separate threads', async () => {
    const keyA = service.createVisitorKey();
    const keyB = service.createVisitorKey();
    visitorKeys.push(keyA, keyB);

    await service.sendVisitorMessage(keyA, 'Message from visitor A');
    await service.sendVisitorMessage(keyB, 'Message from visitor B');

    const threadA = await service.getThread(keyA);
    const threadB = await service.getThread(keyB);

    expect(threadA?.id).not.toBe(threadB?.id);
    expect(threadA?.messages.map((m) => m.body)).toEqual([
      'Message from visitor A',
    ]);
    // The decisive check: A must never see B's message.
    expect(threadB?.messages.map((m) => m.body)).toEqual([
      'Message from visitor B',
    ]);
  });

  it('sets a sliding expiry that moves forward with each message', async () => {
    const key = service.createVisitorKey();
    visitorKeys.push(key);

    await service.sendVisitorMessage(key, 'first');
    const first = await prisma.supportThread.findUniqueOrThrow({
      where: { visitorKey: key },
      select: { expiresAt: true },
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await service.sendVisitorMessage(key, 'second');
    const second = await prisma.supportThread.findUniqueOrThrow({
      where: { visitorKey: key },
      select: { expiresAt: true },
    });

    expect(first.expiresAt).not.toBeNull();
    expect(second.expiresAt!.getTime()).toBeGreaterThan(
      first.expiresAt!.getTime(),
    );

    // And it is roughly the advertised window, not some other number.
    const windowMs = second.expiresAt!.getTime() - Date.now();
    expect(windowMs).toBeLessThanOrEqual(
      ANONYMOUS_THREAD_TTL_MINUTES * 60 * 1000 + 5_000,
    );
  });

  it('adopts the guest thread when the visitor signs in', async () => {
    const key = service.createVisitorKey();
    visitorKeys.push(key);

    await service.sendVisitorMessage(key, 'Asked before registering');
    const before = await service.getThread(key);

    const after = await service.getThread(key, visitorUserId);

    expect(after?.id).toBe(before?.id);
    expect(after?.messages.map((m) => m.body)).toContain(
      'Asked before registering',
    );
    // An account thread is kept, so the expiry must be cleared on adoption.
    expect(after?.expiresAt).toBeNull();
  });

  it('claims an unassigned thread when staff replies', async () => {
    const key = service.createVisitorKey();
    visitorKeys.push(key);

    await service.sendVisitorMessage(key, 'Do you charge to list?');
    const thread = await prisma.supportThread.findUniqueOrThrow({
      where: { visitorKey: key },
      select: { id: true, status: true, assignedToId: true },
    });
    expect(thread.status).toBe('OPEN');
    expect(thread.assignedToId).toBeNull();

    await service.sendStaffMessage(thread.id, 'No, enquiries are free.', staffId);

    const claimed = await prisma.supportThread.findUniqueOrThrow({
      where: { id: thread.id },
      select: { status: true, assignedToId: true },
    });
    expect(claimed.status).toBe('ASSIGNED');
    expect(claimed.assignedToId).toBe(staffId);
  });

  it('erases an expired guest thread and its messages', async () => {
    const key = service.createVisitorKey();
    visitorKeys.push(key);

    await service.sendVisitorMessage(key, 'This should not survive');
    const thread = await prisma.supportThread.findUniqueOrThrow({
      where: { visitorKey: key },
      select: { id: true },
    });

    // Wind the window back rather than waiting 30 real minutes.
    await prisma.supportThread.update({
      where: { id: thread.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const purged = await service.purgeExpired();
    expect(purged).toBeGreaterThanOrEqual(1);

    const gone = await prisma.supportThread.findUnique({
      where: { id: thread.id },
      select: { id: true },
    });
    expect(gone).toBeNull();

    const orphanMessages = await prisma.supportMessage.count({
      where: { threadId: thread.id },
    });
    expect(orphanMessages).toBe(0);
  });

  it('never erases a signed-in thread', async () => {
    const owned = await service.getThread(null, visitorUserId);
    expect(owned).not.toBeNull();

    await service.purgeExpired();

    const survivor = await prisma.supportThread.findUnique({
      where: { id: owned!.id },
      select: { id: true },
    });
    expect(survivor).not.toBeNull();
  });
});
