import { ConflictException, ForbiddenException } from '@nestjs/common';
import { prisma } from '@real-estate/database';
import { AGENT_CASELOAD_LIMIT } from '@real-estate/contracts';
import { ListingPaymentsService } from '../src/features/listing-payments/listing-payments.service';

/**
 * The listing spine end to end against a real database:
 * owner pays -> staff verifies -> staff assigns -> agent accepts -> published.
 */
describe('Listing payment and agent assignment (database)', () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const service = new ListingPaymentsService();

  let ownerId = '';
  let staffId = '';
  let agentUserId = '';
  let agentProfileId = '';
  let listingId = '';
  let proofMediaId = '';

  const createUser = async (role: string) => {
    const user = await prisma.user.create({
      data: {
        name: `${role} ${suffix}`,
        email: `${role}-${suffix}@example.test`,
        emailVerified: true,
      },
      select: { id: true },
    });
    return user.id;
  };

  const createProofMedia = async (ownerUserId: string) => {
    const asset = await prisma.mediaAsset.create({
      data: {
        ownerId: ownerUserId,
        purpose: 'PAYMENT_PROOF',
        visibility: 'PRIVATE',
        status: 'READY',
        bucket: 'bhumiraj-private',
        objectKey: `proofs/${suffix}-${Math.random().toString(16).slice(2)}.avif`,
        originalFileName: 'receipt.png',
        contentType: 'image/avif',
        sizeBytes: BigInt(2048),
      },
      select: { id: true },
    });
    return asset.id;
  };

  beforeAll(async () => {
    ownerId = await createUser('owner');
    staffId = await createUser('staff');
    agentUserId = await createUser('agent');

    const agent = await prisma.agentProfile.create({
      data: { userId: agentUserId, status: 'ACTIVE', verifiedAt: new Date() },
      select: { id: true, maxActiveCases: true },
    });
    agentProfileId = agent.id;

    // A caseload cap of 20 is what the schema default should now provide.
    expect(agent.maxActiveCases).toBe(AGENT_CASELOAD_LIMIT);

    const property = await prisma.property.create({
      data: {
        owner: { connect: { id: ownerId } },
        type: 'HOUSE',
        address: {
          create: {
            province: 'Bagmati',
            district: 'Kathmandu',
            municipality: 'Kathmandu',
            locality: 'Lazimpat',
          },
        },
      },
      select: { id: true },
    });

    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        createdById: ownerId,
        slug: `flow-${suffix}`,
        title: 'Flow test property',
        description: 'A property used by the listing payment flow test.',
        type: 'SALE',
        status: 'AWAITING_PAYMENT',
        priceMinor: BigInt(42500000),
        currency: 'NPR',
      },
      select: { id: true },
    });
    listingId = listing.id;
    proofMediaId = await createProofMedia(ownerId);
  });

  afterAll(async () => {
    const notifications = await prisma.notification.findMany({
      where: { userId: { in: [ownerId, staffId, agentUserId] } },
      select: { id: true },
    });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: notifications.map((row) => row.id) } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [ownerId, staffId, agentUserId] } },
    });
    await prisma.listingAssignment.deleteMany({ where: { listingId } });
    await prisma.listingPaymentProof.deleteMany({ where: { listingId } });
    await prisma.listingStatusHistory.deleteMany({ where: { listingId } });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [ownerId, staffId, agentUserId] } },
    });
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { propertyId: true },
    });
    await prisma.listing.deleteMany({ where: { id: listingId } });
    if (listing) {
      await prisma.property.deleteMany({ where: { id: listing.propertyId } });
    }
    await prisma.mediaAsset.deleteMany({
      where: { ownerId: { in: [ownerId, staffId, agentUserId] } },
    });
    await prisma.agentProfile.deleteMany({ where: { id: agentProfileId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, staffId, agentUserId] } },
    });
  });

  it('refuses a payment submitted by someone other than the owner', async () => {
    const foreignMedia = await createProofMedia(staffId);
    await expect(
      service.submitProof(
        {
          listingId,
          mediaAssetId: foreignMedia,
          method: 'esewa',
          amountMinor: '150000',
          currency: 'NPR',
        },
        staffId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('moves the listing into review when the owner submits proof', async () => {
    const proof = await service.submitProof(
      {
        listingId,
        mediaAssetId: proofMediaId,
        method: 'esewa',
        reference: 'TXN-12345',
        amountMinor: '150000',
        currency: 'NPR',
      },
      ownerId,
    );

    expect(proof.status).toBe('SUBMITTED');
    const listing = await prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      select: { status: true },
    });
    expect(listing.status).toBe('PENDING_REVIEW');
  });

  it('refuses a second open proof for the same listing', async () => {
    const extraMedia = await createProofMedia(ownerId);
    await expect(
      service.submitProof(
        {
          listingId,
          mediaAssetId: extraMedia,
          method: 'esewa',
          amountMinor: '150000',
          currency: 'NPR',
        },
        ownerId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses assignment before the payment is verified', async () => {
    await expect(
      service.assign(
        listingId,
        { agentId: agentProfileId, expiresInHours: 72 },
        staffId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves the payment and awaits an agent', async () => {
    const queue = await service.listProofs({ status: 'SUBMITTED', limit: 25 });
    const pending = queue.items.find((item) => item.listingId === listingId);
    expect(pending).toBeDefined();

    const result = await service.reviewProof(
      pending!.id,
      { decision: 'APPROVE' },
      staffId,
    );
    expect(result.listingStatus).toBe('AWAITING_AGENT');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'LISTING_PAYMENT_APPROVED', entityId: pending!.id },
      select: { actorId: true },
    });
    expect(audit?.actorId).toBe(staffId);
  });

  it('reports the agent caseload before assigning', async () => {
    const agents = await service.assignableAgents();
    const agent = agents.items.find((item) => item.id === agentProfileId);
    expect(agent).toBeDefined();
    expect(agent!.activeCases).toBe(0);
    expect(agent!.maxActiveCases).toBe(AGENT_CASELOAD_LIMIT);
    expect(agent!.atCapacity).toBe(false);
    expect(agent!.nearCapacity).toBe(false);
  });

  it('offers the listing to the agent and publishes on acceptance', async () => {
    const offer = await service.assign(
      listingId,
      { agentId: agentProfileId, expiresInHours: 72 },
      staffId,
    );
    expect(offer.status).toBe('OFFERED');

    const inbox = await service.agentAssignments(agentUserId, 'OFFERED');
    expect(inbox.items.map((item) => item.id)).toContain(offer.id);

    const accepted = await service.respond(
      offer.id,
      { decision: 'ACCEPT' },
      agentUserId,
    );
    expect(accepted.listingStatus).toBe('PUBLISHED');

    const listing = await prisma.listing.findUniqueOrThrow({
      where: { id: listingId },
      select: { status: true, publishedAt: true },
    });
    expect(listing.status).toBe('PUBLISHED');
    expect(listing.publishedAt).not.toBeNull();
  });

  it('refuses a response from an agent the offer does not belong to', async () => {
    const assignment = await prisma.listingAssignment.findFirstOrThrow({
      where: { listingId },
      select: { id: true },
    });
    await expect(
      service.respond(assignment.id, { decision: 'ACCEPT' }, ownerId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('tells a non-agent it is not an agent instead of refusing', async () => {
    // The account chrome asks this on every page, so it must not throw.
    const summary = await service.agentSummary(ownerId);
    expect(summary.isAgent).toBe(false);
  });

  it('reports the accepted listing in the agent caseload', async () => {
    const summary = await service.agentSummary(agentUserId);
    expect(summary.isAgent).toBe(true);
    if (!summary.isAgent) return;
    expect(summary.activeCases).toBe(1);
    expect(summary.pendingOffers).toBe(0);
    expect(summary.caseloadLimit).toBe(AGENT_CASELOAD_LIMIT);
    expect(summary.atCapacity).toBe(false);
  });

  it('lets an agent pause and resume their own availability', async () => {
    const paused = await service.setAgentAvailability(
      agentUserId,
      'UNAVAILABLE',
    );
    expect(paused.isAgent && paused.availabilityStatus).toBe('UNAVAILABLE');

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'AGENT_AVAILABILITY_CHANGED',
        entityId: agentProfileId,
      },
      select: { actorId: true },
    });
    expect(audit?.actorId).toBe(agentUserId);

    const resumed = await service.setAgentAvailability(
      agentUserId,
      'AVAILABLE',
    );
    expect(resumed.isAgent && resumed.availabilityStatus).toBe('AVAILABLE');
  });

  it('refuses an availability change from a non-agent', async () => {
    await expect(
      service.setAgentAvailability(ownerId, 'AVAILABLE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('tells the owner their payment was verified', async () => {
    const notification = await prisma.notification.findFirst({
      where: { userId: ownerId, type: 'listing.payment.approved' },
      select: { body: true },
    });
    expect(notification).not.toBeNull();
    expect(notification!.body).toContain('Flow test property');
  });

  it('tells the agent an offer is waiting', async () => {
    const notification = await prisma.notification.findFirst({
      where: { userId: agentUserId, type: 'listing.assignment.offered' },
      select: { body: true },
    });
    expect(notification).not.toBeNull();
    expect(notification!.body).toContain('Flow test property');
  });

  it('tells the owner the listing went live', async () => {
    const notification = await prisma.notification.findFirst({
      where: { userId: ownerId, type: 'listing.published' },
      select: { body: true },
    });
    expect(notification).not.toBeNull();
  });

  it('queues each notification for delivery through the outbox', async () => {
    // The worker only sends email for events that reach the outbox, so a
    // notification without one is invisible to the user.
    const notifications = await prisma.notification.findMany({
      where: { userId: { in: [ownerId, agentUserId] } },
      select: { id: true },
    });
    expect(notifications.length).toBeGreaterThanOrEqual(3);

    const events = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: 'Notification',
        aggregateId: { in: notifications.map((row) => row.id) },
      },
      select: { aggregateId: true, eventType: true },
    });
    expect(events).toHaveLength(notifications.length);
    for (const event of events) {
      expect(event.eventType).toBe('notification.created');
    }
  });
});
