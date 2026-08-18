import { ConflictException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@real-estate/database';
import {
  NEPAL_UTC_OFFSET_MINUTES,
  VIEWING_DURATION_MINUTES,
} from '@real-estate/contracts';
import { ViewingsService } from '../src/features/viewings/viewings.service';
import { buildSlots } from '../src/features/viewings/viewing-slots';

describe('Viewing scheduler (database)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const service = new ViewingsService();

  let ownerId = '';
  let buyerId = '';
  let agentUserId = '';
  let agentProfileId = '';
  let listingId = '';
  let listingSlug = '';

  const createUser = async (role: string) => {
    const user = await prisma.user.create({
      data: {
        name: `${role} ${suffix}`,
        email: `viewing-${role}-${suffix}@example.test`,
        emailVerified: true,
      },
      select: { id: true },
    });
    return user.id;
  };

  beforeAll(async () => {
    ownerId = await createUser('owner');
    buyerId = await createUser('buyer');
    agentUserId = await createUser('agent');

    const agent = await prisma.agentProfile.create({
      data: { userId: agentUserId, status: 'ACTIVE', verifiedAt: new Date() },
      select: { id: true },
    });
    agentProfileId = agent.id;

    const property = await prisma.property.create({
      data: {
        owner: { connect: { id: ownerId } },
        type: 'HOUSE',
        address: {
          create: {
            province: 'Bagmati',
            district: 'Lalitpur',
            municipality: 'Lalitpur',
            locality: 'Jhamsikhel',
          },
        },
      },
      select: { id: true },
    });

    listingSlug = `viewing-${suffix}`;
    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        createdById: ownerId,
        slug: listingSlug,
        title: 'Viewing test property',
        description: 'A property used by the viewing scheduler test.',
        type: 'SALE',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        priceMinor: BigInt(42500000),
        currency: 'NPR',
      },
      select: { id: true },
    });
    listingId = listing.id;

    // The scheduler only offers slots for the agent representing the listing.
    await prisma.listingAssignment.create({
      data: {
        listingId,
        agentId: agentProfileId,
        assignedById: ownerId,
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    const userIds = [ownerId, buyerId, agentUserId];
    const notifications = await prisma.notification.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: notifications.map((row) => row.id) } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.viewingRequest.deleteMany({ where: { listingId } });
    await prisma.agentAvailabilityWindow.deleteMany({
      where: { agentId: agentProfileId },
    });
    await prisma.listingAssignment.deleteMany({ where: { listingId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { propertyId: true },
    });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    if (listing) {
      await prisma.property.deleteMany({ where: { id: listing.propertyId } });
    }
    await prisma.agentProfile.deleteMany({ where: { id: agentProfileId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('offers no slots until the agent publishes availability', async () => {
    const result = await service.slots(listingSlug, 14);
    expect(result.agent?.id).toBe(agentProfileId);
    expect(result.days).toHaveLength(0);
  });

  it('refuses availability from a non-agent', async () => {
    await expect(
      service.setAvailability(buyerId, [
        { dayOfWeek: 1, startMinute: 540, endMinute: 1020 },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects two windows starting at the same minute', async () => {
    await expect(
      service.setAvailability(agentUserId, [
        { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
        { dayOfWeek: 1, startMinute: 540, endMinute: 1020 },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores a full week of availability', async () => {
    const windows = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    }));
    const saved = await service.setAvailability(agentUserId, windows);
    expect(saved.windows).toHaveLength(7);
    expect(saved.windows[0]!.startMinute).toBe(540);
  });

  it('generates slots on the half hour inside the window', async () => {
    const result = await service.slots(listingSlug, 7);
    expect(result.timezone).toBe('Asia/Kathmandu');
    expect(result.durationMinutes).toBe(VIEWING_DURATION_MINUTES);
    expect(result.days.length).toBeGreaterThan(0);

    // 09:00-17:00 with a 30 minute viewing on a 30 minute grid: the last start
    // is 16:30, so a full day offers 16 slots.
    const fullDay = result.days.find((day) => day.slots.length > 1);
    expect(fullDay).toBeDefined();

    for (const slot of fullDay!.slots) {
      const local = new Date(
        new Date(slot.startsAt).getTime() + NEPAL_UTC_OFFSET_MINUTES * 60_000,
      );
      const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
      expect(minuteOfDay).toBeGreaterThanOrEqual(540);
      expect(minuteOfDay).toBeLessThanOrEqual(16 * 60 + 30);
      expect(minuteOfDay % 30).toBe(0);
    }
  });

  it('refuses a time the agent never offered', async () => {
    const midnight = new Date();
    midnight.setUTCDate(midnight.getUTCDate() + 2);
    midnight.setUTCHours(20, 15, 0, 0);
    await expect(
      service.request(buyerId, listingSlug, {
        startsAt: midnight.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a viewing on the requester own listing', async () => {
    const result = await service.slots(listingSlug, 7);
    const slot = result.days[0]!.slots[0]!;
    await expect(
      service.request(ownerId, listingSlug, { startsAt: slot.startsAt }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('books an offered slot and notifies the agent', async () => {
    const before = await service.slots(listingSlug, 7);
    const slot = before.days[0]!.slots[0]!;

    const viewing = await service.request(buyerId, listingSlug, {
      startsAt: slot.startsAt,
      notes: 'Arriving by taxi.',
    });
    expect(viewing.status).toBe('REQUESTED');
    expect(viewing.durationMinutes).toBe(VIEWING_DURATION_MINUTES);

    const notification = await prisma.notification.findFirst({
      where: { userId: agentUserId, type: 'viewing.requested' },
      select: { id: true },
    });
    expect(notification).not.toBeNull();

    const event = await prisma.outboxEvent.findFirst({
      where: { aggregateId: notification!.id },
      select: { eventType: true },
    });
    expect(event?.eventType).toBe('notification.created');
  });

  it('withdraws a booked slot from the offer set', async () => {
    const booked = await prisma.viewingRequest.findFirstOrThrow({
      where: { listingId },
      select: { scheduledAt: true },
    });
    const after = await service.slots(listingSlug, 7);
    const stillOffered = after.days.some((day) =>
      day.slots.some(
        (slot) =>
          new Date(slot.startsAt).getTime() === booked.scheduledAt.getTime(),
      ),
    );
    expect(stillOffered).toBe(false);
  });

  it('refuses double booking the same slot', async () => {
    const booked = await prisma.viewingRequest.findFirstOrThrow({
      where: { listingId },
      select: { scheduledAt: true },
    });
    await expect(
      service.request(buyerId, listingSlug, {
        startsAt: booked.scheduledAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('shows the request in the agent calendar', async () => {
    const calendar = await service.forAgent(agentUserId, 'REQUESTED');
    expect(calendar.items).toHaveLength(1);
    expect(calendar.items[0]!.listingSlug).toBe(listingSlug);
  });

  it('refuses a response from another agent', async () => {
    const viewing = await prisma.viewingRequest.findFirstOrThrow({
      where: { listingId },
      select: { id: true },
    });
    await expect(
      service.respond(viewing.id, buyerId, { decision: 'CONFIRM' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('confirms the viewing and tells the buyer', async () => {
    const viewing = await prisma.viewingRequest.findFirstOrThrow({
      where: { listingId },
      select: { id: true },
    });
    const result = await service.respond(viewing.id, agentUserId, {
      decision: 'CONFIRM',
    });
    expect(result.status).toBe('CONFIRMED');

    const notification = await prisma.notification.findFirst({
      where: { userId: buyerId, type: 'viewing.confirmed' },
      select: { id: true },
    });
    expect(notification).not.toBeNull();
  });

  it('refuses answering the same viewing twice', async () => {
    const viewing = await prisma.viewingRequest.findFirstOrThrow({
      where: { listingId },
      select: { id: true },
    });
    await expect(
      service.respond(viewing.id, agentUserId, { decision: 'CONFIRM' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Viewing slot arithmetic', () => {
  // A Monday at 00:00 UTC, so the Nepal-local day is unambiguous.
  const monday = new Date('2026-09-07T00:00:00.000Z');

  it('merges overlapping windows instead of duplicating slots', () => {
    const days = buildSlots({
      windows: [
        { dayOfWeek: 1, startMinute: 540, endMinute: 720 },
        { dayOfWeek: 1, startMinute: 660, endMinute: 840 },
      ],
      busy: [],
      days: 2,
      durationMinutes: 30,
      leadMinutes: 0,
      now: monday,
    });

    const starts = days.flatMap((day) =>
      day.slots.map((slot) => slot.startsAt.getTime()),
    );
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('drops slots inside the notice period', () => {
    const withoutLead = buildSlots({
      windows: [{ dayOfWeek: 1, startMinute: 0, endMinute: 1440 }],
      busy: [],
      days: 1,
      durationMinutes: 30,
      leadMinutes: 0,
      now: monday,
    });
    const withLead = buildSlots({
      windows: [{ dayOfWeek: 1, startMinute: 0, endMinute: 1440 }],
      busy: [],
      days: 1,
      durationMinutes: 30,
      leadMinutes: 6 * 60,
      now: monday,
    });

    const countWithout = withoutLead[0]?.slots.length ?? 0;
    const countWith = withLead[0]?.slots.length ?? 0;
    expect(countWith).toBeLessThan(countWithout);
  });

  it('excludes a slot that overlaps an existing booking', () => {
    const windows = [{ dayOfWeek: 1, startMinute: 540, endMinute: 660 }];
    const free = buildSlots({
      windows,
      busy: [],
      days: 1,
      durationMinutes: 30,
      leadMinutes: 0,
      now: monday,
    });
    const target = free[0]!.slots[1]!.startsAt;

    const blocked = buildSlots({
      windows,
      busy: [
        {
          startsAt: target,
          endsAt: new Date(target.getTime() + 30 * 60_000),
        },
      ],
      days: 1,
      durationMinutes: 30,
      leadMinutes: 0,
      now: monday,
    });

    const remaining = blocked[0]!.slots.map((slot) => slot.startsAt.getTime());
    expect(remaining).not.toContain(target.getTime());
    expect(remaining).toHaveLength(free[0]!.slots.length - 1);
  });

  it('never starts a viewing that would run past the window', () => {
    const days = buildSlots({
      windows: [{ dayOfWeek: 1, startMinute: 540, endMinute: 600 }],
      busy: [],
      days: 1,
      durationMinutes: 45,
      leadMinutes: 0,
      now: monday,
    });
    // A 60 minute window fits exactly one 45 minute viewing, at the start.
    expect(days[0]?.slots).toHaveLength(1);
  });
});
