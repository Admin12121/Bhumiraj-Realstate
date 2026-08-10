import { prisma } from "@real-estate/database";
import { AuctionsService } from "../src/features/auctions/auctions.service";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;
describeDb("Auction transaction serialization", () => {
  const service = new AuctionsService();
  const suffix = Date.now().toString();
  let auctionId = "";
  const bidders: string[] = [];

  beforeAll(async () => {
    const seller = await prisma.user.create({ data: { name: "Concurrency Seller", email: `seller-${suffix}@test.local`, emailVerified: true, profile: { create: { phoneVerifiedAt: new Date() } }, identityVerification: { create: { status: "VERIFIED", verifiedAt: new Date() } } } });
    const address = await prisma.address.create({ data: { province: "Bagmati", district: "Kathmandu", municipality: "Kathmandu", locality: "Test" } });
    const property = await prisma.property.create({ data: { ownerId: seller.id, addressId: address.id, type: "HOUSE", specification: { create: { areaSqFt: 1000 } } } });
    const listing = await prisma.listing.create({ data: { propertyId: property.id, createdById: seller.id, slug: `concurrency-${suffix}`, title: "Concurrency Auction", description: "Integration test auction listing with sufficient description length for the platform.", type: "AUCTION", status: "PUBLISHED", publishedAt: new Date() } });
    const now = Date.now();
    const auction = await prisma.auction.create({ data: { listingId: listing.id, status: "LIVE", currency: "NPR", startingAmountMinor: 1_000_000n, currentAmountMinor: 1_000_000n, minimumIncrementMinor: 10_000n, startsAt: new Date(now - 60_000), originalEndsAt: new Date(now + 600_000), endsAt: new Date(now + 600_000), maximumExtendedUntil: new Date(now + 1_800_000) } });
    auctionId = auction.id;
    for (let index = 0; index < 20; index++) {
      const user = await prisma.user.create({ data: { name: `Bidder ${index}`, email: `bidder-${suffix}-${index}@test.local`, emailVerified: true, profile: { create: { phoneVerifiedAt: new Date() } }, identityVerification: { create: { status: "VERIFIED", verifiedAt: new Date() } } } });
      bidders.push(user.id);
      await prisma.auctionRegistration.create({ data: { auctionId, userId: user.id, status: "ELIGIBLE" } });
    }
  });

  afterAll(async () => {
    if (!auctionId) return;
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        listingId: true,
        listing: { select: { propertyId: true, property: { select: { addressId: true } } } },
      },
    });
    await prisma.$transaction(async (tx) => {
      await tx.auction.update({ where: { id: auctionId }, data: { currentBidId: null } });
      await tx.auctionExtension.deleteMany({ where: { auctionId } });
      await tx.auctionSettlement.deleteMany({ where: { auctionId } });
      await tx.bid.deleteMany({ where: { auctionId } });
      await tx.auctionRegistration.deleteMany({ where: { auctionId } });
      await tx.auditLog.deleteMany({ where: { entityId: auctionId } });
      await tx.outboxEvent.deleteMany({ where: { aggregateId: auctionId } });
      await tx.auction.delete({ where: { id: auctionId } });
      if (auction) {
        await tx.listing.delete({ where: { id: auction.listingId } });
        await tx.property.delete({ where: { id: auction.listing.propertyId } });
        await tx.address.delete({ where: { id: auction.listing.property.addressId } });
      }
      await tx.user.deleteMany({ where: { email: { contains: suffix } } });
    });
  });

  it("commits unique monotonically ordered bids under contention", async () => {
    const attempts = bidders.map((bidderId, index) => service.placeBid(auctionId, bidderId, String(1_020_000 + index * 20_000), `attempt-${suffix}-${index}`));
    const results = await Promise.allSettled(attempts);
    const accepted = results.filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled");
    expect(accepted.length).toBeGreaterThan(0);
    const bids = await prisma.bid.findMany({ where: { auctionId }, orderBy: { sequence: "asc" } });
    expect(new Set(bids.map((bid) => bid.sequence)).size).toBe(bids.length);
    bids.forEach((bid, index) => expect(bid.sequence).toBe(index + 1));
    const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId } });
    expect(auction.sequence).toBe(bids.length);
    expect(auction.eventSequence).toBe(bids.length);
    expect(auction.currentAmountMinor).toBe(bids.at(-1)?.amountMinor);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: auctionId, eventType: "auction.bid.accepted" } })).toBe(bids.length);
  });

  it("returns the original result for a repeated idempotency key", async () => {
    const userId = bidders[0]!;
    const first = await service.placeBid(auctionId, userId, "3000000", `duplicate-${suffix}`);
    const second = await service.placeBid(auctionId, userId, "3000000", `duplicate-${suffix}`);
    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
  });
  it("rejects reuse of an idempotency key with a different amount", async () => {
    const userId = bidders[1]!;
    const key = `mismatch-${suffix}`;
    await service.placeBid(auctionId, userId, "4000000", key);
    await expect(
      service.placeBid(auctionId, userId, "4100000", key),
    ).rejects.toMatchObject({ status: 409 });
  });

});
