import {
  Body,
  Controller,
  Headers,
  NotFoundException,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import { prisma } from "@real-estate/database";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { apiEnv } from "../../bootstrap-env";

const fixturesSchema = z.object({
  adminEmail: z.email(),
  bidderEmail: z.email(),
});

@Controller("api/v1/testing")
export class E2eFixturesController {
  @Post("fixtures")
  @AllowAnonymous()
  async createFixtures(
    @Headers("x-e2e-key") setupKey: string | undefined,
    @Body(new ZodValidationPipe(fixturesSchema))
    body: z.infer<typeof fixturesSchema>,
  ) {
    if (!apiEnv.E2E_MODE) {
      throw new NotFoundException();
    }
    if (!apiEnv.E2E_SETUP_KEY || setupKey !== apiEnv.E2E_SETUP_KEY) {
      throw new UnauthorizedException();
    }

    const [admin, bidder] = await Promise.all([
      prisma.user.findUnique({ where: { email: body.adminEmail } }),
      prisma.user.findUnique({ where: { email: body.bidderEmail } }),
    ]);
    if (!admin || !bidder) {
      throw new NotFoundException({
        code: "E2E_USERS_MISSING",
        message: "Create the E2E credential users through Better Auth first.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: admin.id },
        data: {
          role: "OWNER",
          emailVerified: true,
          banned: false,
          lifecycleStatus: "ACTIVE",
          deletionRequestedAt: null,
        },
      });
      await tx.user.update({
        where: { id: bidder.id },
        data: {
          role: "USER",
          emailVerified: true,
          banned: false,
          lifecycleStatus: "ACTIVE",
          deletionRequestedAt: null,
        },
      });

      await tx.userProfile.upsert({
        where: { userId: admin.id },
        update: { phoneVerifiedAt: new Date(), username: "e2e_admin" },
        create: {
          userId: admin.id,
          phoneVerifiedAt: new Date(),
          username: "e2e_admin",
        },
      });
      await tx.userProfile.upsert({
        where: { userId: bidder.id },
        update: { phoneVerifiedAt: new Date(), username: "e2e_bidder" },
        create: {
          userId: bidder.id,
          phoneVerifiedAt: new Date(),
          username: "e2e_bidder",
        },
      });
      await tx.identityVerification.upsert({
        where: { userId: admin.id },
        update: { status: "VERIFIED", verifiedAt: new Date() },
        create: { userId: admin.id, status: "VERIFIED", verifiedAt: new Date() },
      });
      await tx.identityVerification.upsert({
        where: { userId: bidder.id },
        update: { status: "VERIFIED", verifiedAt: new Date() },
        create: { userId: bidder.id, status: "VERIFIED", verifiedAt: new Date() },
      });
    });

    const address = await prisma.address.upsert({
      where: { id: "00000000-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-4000-8000-000000000001",
        province: "Bagmati",
        district: "Kathmandu",
        municipality: "Budhanilkantha",
        locality: "Budhanilkantha",
        latitude: 27.78,
        longitude: 85.36,
        publicLatitude: 27.78,
        publicLongitude: 85.36,
      },
    });

    const property = await prisma.property.upsert({
      where: { id: "00000000-0000-4000-8000-000000000002" },
      update: {
        ownerId: admin.id,
        addressId: address.id,
        ownershipStatus: "VERIFIED",
      },
      create: {
        id: "00000000-0000-4000-8000-000000000002",
        ownerId: admin.id,
        addressId: address.id,
        type: "HOUSE",
        ownershipStatus: "VERIFIED",
      },
    });
    await prisma.propertySpecification.upsert({
      where: { propertyId: property.id },
      update: {
        bedrooms: 5,
        bathrooms: 5,
        parkingSpaces: 2,
        areaSqFt: 4200,
      },
      create: {
        propertyId: property.id,
        bedrooms: 5,
        bathrooms: 5,
        parkingSpaces: 2,
        areaSqFt: 4200,
      },
    });

    const listing = await prisma.listing.upsert({
      where: { slug: "e2e-live-auction-villa" },
      update: {
        createdById: admin.id,
        propertyId: property.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      create: {
        id: "00000000-0000-4000-8000-000000000003",
        propertyId: property.id,
        createdById: admin.id,
        slug: "e2e-live-auction-villa",
        title: "E2E Live Auction Villa",
        description:
          "A verified E2E auction property used to exercise transaction ordering, realtime updates and bidder eligibility.",
        type: "AUCTION",
        status: "PUBLISHED",
        isVerified: true,
        publishedAt: new Date(),
      },
    });

    const now = Date.now();
    const existingAuction = await prisma.auction.findUnique({
      where: { listingId: listing.id },
      select: { id: true },
    });
    if (existingAuction) {
      await prisma.$transaction(async (tx) => {
        await tx.auction.update({
          where: { id: existingAuction.id },
          data: { currentBidId: null },
        });
        await tx.auctionExtension.deleteMany({
          where: { auctionId: existingAuction.id },
        });
        await tx.auctionSettlement.deleteMany({
          where: { auctionId: existingAuction.id },
        });
        await tx.bid.deleteMany({ where: { auctionId: existingAuction.id } });
      });
    }
    const auction = await prisma.auction.upsert({
      where: { listingId: listing.id },
      update: {
        status: "LIVE",
        startsAt: new Date(now - 60_000),
        endsAt: new Date(now + 15 * 60_000),
        originalEndsAt: new Date(now + 15 * 60_000),
        maximumExtendedUntil: new Date(now + 45 * 60_000),
        currentBidId: null,
        currentAmountMinor: 10_000_000n,
        bidCount: 0,
        sequence: 0,
        eventSequence: 0,
        version: { increment: 1 },
      },
      create: {
        id: "00000000-0000-4000-8000-000000000004",
        listingId: listing.id,
        status: "LIVE",
        currency: "NPR",
        startingAmountMinor: 10_000_000n,
        currentAmountMinor: 10_000_000n,
        minimumIncrementMinor: 100_000n,
        startsAt: new Date(now - 60_000),
        originalEndsAt: new Date(now + 15 * 60_000),
        endsAt: new Date(now + 15 * 60_000),
        maximumExtendedUntil: new Date(now + 45 * 60_000),
      },
    });
    await prisma.auctionRegistration.upsert({
      where: { auctionId_userId: { auctionId: auction.id, userId: bidder.id } },
      update: { status: "ELIGIBLE", depositStatus: "NOT_REQUIRED" },
      create: {
        auctionId: auction.id,
        userId: bidder.id,
        status: "ELIGIBLE",
        depositStatus: "NOT_REQUIRED",
      },
    });

    for (let index = 1; index <= 14; index += 1) {
      const suffix = String(index).padStart(2, "0");
      await prisma.listing.upsert({
        where: { slug: `e2e-feed-property-${suffix}` },
        update: {
          createdById: admin.id,
          propertyId: property.id,
          status: "PUBLISHED",
          publishedAt: new Date(now - index * 60_000),
        },
        create: {
          propertyId: property.id,
          createdById: admin.id,
          slug: `e2e-feed-property-${suffix}`,
          title: `Verified Kathmandu Property ${suffix}`,
          description:
            "A seeded marketplace property used to verify cursor-based infinite scrolling, stable ordering and responsive listing cards.",
          type: index % 3 === 0 ? "RENT" : "SALE",
          status: "PUBLISHED",
          currency: "NPR",
          priceMinor: BigInt(12_000_000_00 + index * 100_000_00),
          rentPeriod: index % 3 === 0 ? "MONTH" : null,
          isVerified: true,
          favoriteCount: index,
          viewCount: BigInt(index * 10),
          publishedAt: new Date(now - index * 60_000),
        },
      });
    }

    return {
      ready: true,
      auctionId: auction.id,
      adminId: admin.id,
      bidderId: bidder.id,
    };
  }
}
