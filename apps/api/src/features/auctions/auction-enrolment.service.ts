import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@real-estate/database";
import {
  auctionDepositSettingsSchema,
  type AuctionDepositSettings,
} from "@real-estate/contracts";
import { apiEnv } from "../../bootstrap-env";
import { notify } from "../../shared/notifications/notify";

const DEPOSIT_SETTING_KEY = "auctionDeposit";

/** Used until an administrator saves a deposit configuration. */
const DEFAULT_DEPOSIT: AuctionDepositSettings = {
  amountMinor: "2500000",
  currency: "NPR",
  required: true,
  methods: [],
};

/** Largest first — a downscaled QR code stops being scannable. */
const QR_VARIANT_PREFERENCE = ["full", "large", "card", "thumb"] as const;

/**
 * Enrolling in an auction: the bidder pays a deposit out of band and uploads
 * the receipt, and staff decide who joins the bidder list. Approval is
 * deliberately manual.
 */
@Injectable()
export class AuctionEnrolmentService {
  async depositSettings(): Promise<AuctionDepositSettings> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: DEPOSIT_SETTING_KEY },
      select: { value: true },
    });
    if (!row) return DEFAULT_DEPOSIT;

    const parsed = auctionDepositSettingsSchema.safeParse(row.value);
    if (!parsed.success) return DEFAULT_DEPOSIT;
    return this.resolveMethodImages(parsed.data);
  }

  async updateDepositSettings(
    raw: AuctionDepositSettings,
    actorId: string,
  ): Promise<AuctionDepositSettings> {
    const input = await this.resolveMethodImages(raw);
    await prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: DEPOSIT_SETTING_KEY },
        create: {
          key: DEPOSIT_SETTING_KEY,
          value: input,
          updatedById: actorId,
        },
        update: { value: input, updatedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "SETTINGS_UPDATED",
          entityType: "SystemSetting",
          entityId: DEPOSIT_SETTING_KEY,
        },
      });
    });
    return input;
  }

  /** Everything the enrolment screen shows, including where the bidder stands. */
  async view(auctionId: string, userId: string) {
    const [auction, user, deposit] = await Promise.all([
      prisma.auction.findUnique({
        where: { id: auctionId },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          startingAmountMinor: true,
          depositAmountMinor: true,
          currency: true,
          listing: {
            select: { title: true, slug: true, status: true, createdById: true },
          },
          registrations: {
            where: { userId },
            take: 1,
            select: {
              id: true,
              auctionId: true,
              status: true,
              depositStatus: true,
              deposit: {
                select: { rejectionReason: true, submittedAt: true },
              },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true },
      }),
      this.depositSettings(),
    ]);

    if (!auction || auction.listing.status !== "PUBLISHED") {
      throw new NotFoundException();
    }
    if (!user) throw new NotFoundException();

    const registration = auction.registrations[0];
    return {
      auctionId: auction.id,
      auctionStatus: auction.status,
      listingTitle: auction.listing.title,
      listingSlug: auction.listing.slug,
      startsAt: auction.startsAt.toISOString(),
      endsAt: auction.endsAt.toISOString(),
      startingAmountMinor: auction.startingAmountMinor.toString(),
      currency: auction.currency,
      emailVerified: user.emailVerified,
      // The auction's own figure wins; the platform default is the fallback.
      deposit: {
        ...deposit,
        amountMinor:
          auction.depositAmountMinor?.toString() ?? deposit.amountMinor,
      },
      registration: registration
        ? {
            id: registration.id,
            auctionId: registration.auctionId,
            status: registration.status,
            depositStatus: registration.depositStatus,
            rejectionReason: registration.deposit?.rejectionReason ?? null,
            submittedAt:
              registration.deposit?.submittedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * Records the bidder's deposit receipt and puts them in the review queue.
   * Nothing here grants eligibility — only a staff review does.
   */
  async submit(
    auctionId: string,
    userId: string,
    input: { mediaAssetId: string; method: string; reference?: string | undefined },
  ) {
    const [auction, user, settings] = await Promise.all([
      prisma.auction.findUnique({
        where: { id: auctionId },
        select: {
          id: true,
          status: true,
          currency: true,
          depositAmountMinor: true,
          listing: { select: { status: true, createdById: true, title: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailVerified: true,
          banned: true,
          lifecycleStatus: true,
        },
      }),
      this.depositSettings(),
    ]);

    if (!auction || auction.listing.status !== "PUBLISHED") {
      throw new NotFoundException();
    }
    if (!user || user.banned || user.lifecycleStatus !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_NOT_ACTIVE",
        message: "This operation requires an active account.",
      });
    }
    if (!user.emailVerified) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before enrolling in an auction.",
      });
    }
    if (!["SCHEDULED", "LIVE"].includes(auction.status)) {
      throw new ConflictException({
        code: "REGISTRATION_CLOSED",
        message: "Enrolment is closed for this auction.",
      });
    }
    if (auction.listing.createdById === userId) {
      throw new ForbiddenException({
        code: "SELLER_CANNOT_BID",
        message: "The property seller cannot enrol as a bidder.",
      });
    }

    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: input.mediaAssetId,
        ownerId: userId,
        status: "READY",
        purpose: "PAYMENT_PROOF",
      },
      select: { id: true },
    });
    if (!asset) {
      throw new ConflictException({
        code: "PROOF_NOT_READY",
        message: "The payment screenshot is still processing.",
      });
    }

    const depositAmount =
      auction.depositAmountMinor?.toString() ?? settings.amountMinor;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.auctionRegistration.findUnique({
        where: { auctionId_userId: { auctionId, userId } },
        select: { id: true, status: true },
      });
      if (existing?.status === "ELIGIBLE") {
        throw new ConflictException({
          code: "ALREADY_ENROLLED",
          message: "You are already approved to bid in this auction.",
        });
      }

      const registration = await tx.auctionRegistration.upsert({
        where: { auctionId_userId: { auctionId, userId } },
        create: { auctionId, userId, status: "PENDING" },
        update: { status: "PENDING", reviewedAt: null },
        select: { id: true, auctionId: true },
      });

      await tx.auctionDeposit.upsert({
        where: { registrationId: registration.id },
        create: {
          registrationId: registration.id,
          amountMinor: BigInt(depositAmount),
          currency: settings.currency,
          status: "PENDING",
          mediaAssetId: input.mediaAssetId,
          method: input.method,
          reference: input.reference ?? null,
          submittedAt: new Date(),
        },
        update: {
          amountMinor: BigInt(depositAmount),
          currency: settings.currency,
          status: "PENDING",
          mediaAssetId: input.mediaAssetId,
          method: input.method,
          reference: input.reference ?? null,
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          rejectionReason: null,
        },
      });

      await tx.auctionRegistration.update({
        where: { id: registration.id },
        data: { depositStatus: "PENDING" },
      });

      return {
        id: registration.id,
        auctionId: registration.auctionId,
        status: "PENDING" as const,
        depositStatus: "PENDING" as const,
      };
    });
  }

  /** The staff review queue. */
  async queue(status: "PENDING" | "ELIGIBLE" | "REJECTED", limit: number) {
    const rows = await prisma.auctionRegistration.findMany({
      where: { status, deposit: { isNot: null } },
      orderBy: { registeredAt: "desc" },
      take: limit,
      select: {
        id: true,
        auctionId: true,
        status: true,
        depositStatus: true,
        auction: { select: { listing: { select: { title: true } } } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
          },
        },
        deposit: {
          select: {
            amountMinor: true,
            currency: true,
            method: true,
            reference: true,
            mediaAssetId: true,
            submittedAt: true,
          },
        },
      },
    });

    return {
      items: rows.map((row) => ({
        registrationId: row.id,
        auctionId: row.auctionId,
        auctionTitle: row.auction.listing.title,
        status: row.status,
        depositStatus: row.depositStatus,
        amountMinor: row.deposit?.amountMinor.toString() ?? "0",
        currency: row.deposit?.currency ?? "NPR",
        method: row.deposit?.method ?? null,
        reference: row.deposit?.reference ?? null,
        mediaAssetId: row.deposit?.mediaAssetId ?? null,
        submittedAt: row.deposit?.submittedAt?.toISOString() ?? null,
        bidder: row.user,
      })),
    };
  }

  /**
   * The only way onto an auction's bidder list. Approving marks the deposit
   * CAPTURED because the money has already been received out of band — that
   * pair is what `placeBid` checks.
   */
  async review(
    registrationId: string,
    actorId: string,
    input: {
      decision: "APPROVE" | "REJECT";
      rejectionReason?: string | undefined;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const registration = await tx.auctionRegistration.findUnique({
        where: { id: registrationId },
        select: {
          id: true,
          userId: true,
          auctionId: true,
          status: true,
          auction: { select: { listing: { select: { title: true } } } },
        },
      });
      if (!registration) throw new NotFoundException();

      const approved = input.decision === "APPROVE";
      await tx.auctionRegistration.update({
        where: { id: registration.id },
        data: {
          status: approved ? "ELIGIBLE" : "REJECTED",
          depositStatus: approved ? "CAPTURED" : "FAILED",
          reviewedAt: new Date(),
        },
      });
      await tx.auctionDeposit.update({
        where: { registrationId: registration.id },
        data: {
          status: approved ? "CAPTURED" : "FAILED",
          reviewedAt: new Date(),
          reviewedById: actorId,
          rejectionReason: approved ? null : (input.rejectionReason ?? null),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: approved ? "AUCTION_ENROLMENT_APPROVED" : "AUCTION_ENROLMENT_REJECTED",
          entityType: "AuctionRegistration",
          entityId: registration.id,
        },
      });

      await notify(tx, {
        userId: registration.userId,
        type: approved ? "AUCTION_ENROLMENT_APPROVED" : "AUCTION_ENROLMENT_REJECTED",
        title: approved
          ? "You are approved to bid"
          : "Auction enrolment rejected",
        body: approved
          ? `You can now bid on ${registration.auction.listing.title}.`
          : (input.rejectionReason ??
            `Your enrolment for ${registration.auction.listing.title} was rejected.`),
        data: { url: `/auctions/${registration.auctionId}` },
      });

      return { id: registration.id, status: approved ? "ELIGIBLE" : "REJECTED" };
    });
  }

  /** Turns uploaded QR assets into CDN URLs; the client never supplies them. */
  private async resolveMethodImages(
    input: AuctionDepositSettings,
  ): Promise<AuctionDepositSettings> {
    const assetIds = input.methods
      .map((method) => method.imageAssetId)
      .filter((id): id is string => Boolean(id));

    const assets = assetIds.length
      ? await prisma.mediaAsset.findMany({
          where: { id: { in: assetIds }, purpose: "PAYMENT_QR", status: "READY" },
          select: {
            id: true,
            objectKey: true,
            variants: { select: { name: true, objectKey: true } },
          },
        })
      : [];

    const base = apiEnv.CDN_BASE_URL.replace(/\/$/, "");
    const urlById = new Map(
      assets.map((asset) => {
        const variant =
          QR_VARIANT_PREFERENCE.map((name) =>
            asset.variants.find((entry) => entry.name === name),
          ).find(Boolean) ?? asset.variants[0];
        return [asset.id, `${base}/${variant?.objectKey ?? asset.objectKey}`];
      }),
    );

    return {
      ...input,
      methods: input.methods.map((method) => ({
        ...method,
        imageUrl: method.imageAssetId
          ? (urlById.get(method.imageAssetId) ?? null)
          : null,
      })),
    };
  }
}
