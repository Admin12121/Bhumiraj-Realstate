import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@real-estate/database";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";
import { apiEnv } from "../../bootstrap-env";

const MAX_TRANSACTION_ATTEMPTS = 3;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const bidCursorSchema = z
  .object({ acceptedAt: z.iso.datetime({ offset: true }), id: z.uuid() })
  .strict();
const historyCursorSchema = z.object({ sequence: z.number().int().positive() }).strict();

@Injectable()
export class AuctionsService {
  async snapshot(id: string, userId?: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        listing: {
          select: {
            status: true,
            createdById: true,
            title: true,
            slug: true,
            description: true,
            isVerified: true,
            property: {
              select: {
                address: { select: { locality: true, district: true } },
              },
            },
            media: {
              take: 1,
              orderBy: { position: "asc" },
              select: {
                mediaAsset: {
                  select: {
                    objectKey: true,
                    variants: {
                      where: { name: { in: ["hero", "card"] } },
                      orderBy: { name: "desc" },
                      take: 1,
                      select: { objectKey: true },
                    },
                  },
                },
              },
            },
          },
        },
        registrations: userId ? { where: { userId }, take: 1 } : false,
        currentBid: {
          select: { bidderId: true, bidder: { select: { name: true } } },
        },
      },
    });

    if (
      !auction ||
      (auction.listing.status !== "PUBLISHED" &&
        auction.listing.createdById !== userId)
    ) {
      throw new NotFoundException();
    }

    const [clock] = await prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT NOW() AS now
    `;
    const registration = Array.isArray(auction.registrations)
      ? auction.registrations[0]
      : undefined;

    return {
      id: auction.id,
      listingId: auction.listingId,
      status: auction.status,
      currency: auction.currency,
      startingAmountMinor: auction.startingAmountMinor.toString(),
      currentAmountMinor: auction.currentAmountMinor.toString(),
      minimumIncrementMinor: auction.minimumIncrementMinor.toString(),
      bidCount: auction.bidCount,
      startsAt: auction.startsAt.toISOString(),
      endsAt: auction.endsAt.toISOString(),
      serverTime: (clock?.now ?? new Date()).toISOString(),
      sequence: auction.sequence,
      eventSequence: auction.eventSequence,
      registered: Boolean(registration),
      eligible:
        registration?.status === "ELIGIBLE" &&
        ["NOT_REQUIRED", "AUTHORIZED", "CAPTURED"].includes(
          registration.depositStatus,
        ),
      winningBidderDisplay: auction.currentBid
        ? this.maskName(auction.currentBid.bidder.name)
        : null,
      listing: {
        title: auction.listing.title,
        slug: auction.listing.slug,
        description: auction.listing.description,
        isVerified: auction.listing.isVerified,
        location: auction.listing.property.address,
        coverImageUrl: this.publicMediaUrl(
          auction.listing.media[0]?.mediaAsset.variants[0]?.objectKey ??
            auction.listing.media[0]?.mediaAsset.objectKey ??
            null,
        ),
      },
    };
  }

  async register(id: string, userId: string) {
    const [user, auction, identity, identitySetting] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      }),
      prisma.auction.findUnique({
        where: { id },
        include: { listing: { select: { status: true, createdById: true } } },
      }),
      prisma.identityVerification.findUnique({ where: { userId } }),
      prisma.systemSetting.findUnique({
        where: { key: "auctionIdentityRequired" },
        select: { value: true },
      }),
    ]);

    this.assertActiveUser(user);
    if (!auction || auction.listing.status !== "PUBLISHED") {
      throw new NotFoundException();
    }
    if (!["SCHEDULED", "LIVE"].includes(auction.status)) {
      throw new ConflictException({
        code: "REGISTRATION_CLOSED",
        message: "Registration is closed for this auction.",
      });
    }
    if (auction.listing.createdById === userId) {
      throw new ForbiddenException({
        code: "SELLER_CANNOT_BID",
        message: "The property seller cannot register as a bidder.",
      });
    }
    if (!user.emailVerified) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before registering.",
      });
    }

    const identityRequired =
      typeof identitySetting?.value === "boolean" ? identitySetting.value : true;
    const eligible =
      Boolean(user.profile?.phoneVerifiedAt) &&
      (!identityRequired || identity?.status === "VERIFIED");

    return prisma.auctionRegistration.upsert({
      where: { auctionId_userId: { auctionId: id, userId } },
      update: {
        status: eligible ? "ELIGIBLE" : "PENDING",
        reviewedAt: eligible ? new Date() : null,
      },
      create: {
        auctionId: id,
        userId,
        status: eligible ? "ELIGIBLE" : "PENDING",
      },
      select: {
        id: true,
        auctionId: true,
        status: true,
        depositStatus: true,
      },
    });
  }

  async placeBid(
    auctionId: string,
    userId: string,
    amountText: string,
    idempotencyKey: string,
    requestId?: string,
  ) {
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey ?? "")) {
      throw new ConflictException({
        code: "IDEMPOTENCY_REQUIRED",
        message: "A valid Idempotency-Key header is required.",
      });
    }

    let amount: bigint;
    try {
      amount = BigInt(amountText);
    } catch {
      throw new ConflictException({
        code: "INVALID_BID_AMOUNT",
        message: "Bid amount must be an integer in minor units.",
      });
    }
    if (amount <= 0n) {
      throw new ConflictException({
        code: "INVALID_BID_AMOUNT",
        message: "Bid amount must be greater than zero.",
      });
    }

    const bidder = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        banned: true,
        lifecycleStatus: true,
        emailVerified: true,
      },
    });
    this.assertActiveUser(bidder);
    if (!bidder.emailVerified) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before bidding.",
      });
    }

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`
              SELECT id FROM "Auction" WHERE id = ${auctionId} FOR UPDATE
            `;
            const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`
              SELECT NOW() AS now
            `;
            const now = clock?.now ?? new Date();

            const existing = await tx.bid.findUnique({
              where: {
                auctionId_bidderId_idempotencyKey: {
                  auctionId,
                  bidderId: userId,
                  idempotencyKey,
                },
              },
            });
            if (existing) {
              if (existing.amountMinor !== amount) {
                throw new ConflictException({
                  code: "IDEMPOTENCY_KEY_REUSED",
                  message:
                    "This idempotency key was already used for a different bid amount.",
                });
              }
              const auction = await tx.auction.findUniqueOrThrow({
                where: { id: auctionId },
                select: { endsAt: true, eventSequence: true },
              });
              return {
                id: existing.id,
                auctionId: existing.auctionId,
                amountMinor: existing.amountMinor.toString(),
                sequence: existing.sequence,
                eventSequence: auction.eventSequence,
                bidderDisplay: "You",
                acceptedAt: existing.acceptedAt.toISOString(),
                mine: true,
                endsAt: auction.endsAt.toISOString(),
                duplicate: true,
              };
            }

            const auction = await tx.auction.findUnique({
              where: { id: auctionId },
              include: {
                listing: { select: { status: true, createdById: true } },
                currentBid: { select: { bidderId: true } },
              },
            });
            if (!auction || auction.listing.status !== "PUBLISHED") {
              throw new NotFoundException();
            }
            if (auction.listing.createdById === userId) {
              throw new ForbiddenException({
                code: "SELLER_CANNOT_BID",
                message: "The property seller cannot bid on this auction.",
              });
            }
            if (
              auction.status !== "LIVE" ||
              now < auction.startsAt ||
              now >= auction.endsAt
            ) {
              throw new ConflictException({
                code: "AUCTION_NOT_LIVE",
                message: "The auction is not accepting bids.",
              });
            }

            const registration = await tx.auctionRegistration.findUnique({
              where: { auctionId_userId: { auctionId, userId } },
            });
            if (
              registration?.status !== "ELIGIBLE" ||
              !["NOT_REQUIRED", "AUTHORIZED", "CAPTURED"].includes(
                registration.depositStatus,
              )
            ) {
              throw new ForbiddenException({
                code: "BIDDER_NOT_ELIGIBLE",
                message:
                  "Approved registration, verification and any required deposit are required.",
              });
            }

            const minimum =
              auction.bidCount === 0
                ? auction.startingAmountMinor
                : auction.currentAmountMinor + auction.minimumIncrementMinor;
            if (amount < minimum) {
              throw new ConflictException({
                code: "BID_TOO_LOW",
                message: `Minimum bid is ${minimum.toString()}.`,
              });
            }

            const bidSequence = auction.sequence + 1;
            const eventSequence = auction.eventSequence + 1;
            const bid = await tx.bid.create({
              data: {
                auctionId,
                bidderId: userId,
                amountMinor: amount,
                sequence: bidSequence,
                previousBidId: auction.currentBidId,
                idempotencyKey,
                requestId: requestId ?? null,
              },
            });

            let endsAt = auction.endsAt;
            const remainingMs = auction.endsAt.getTime() - now.getTime();
            if (
              remainingMs <= auction.extensionWindowSeconds * 1000 &&
              auction.endsAt < auction.maximumExtendedUntil
            ) {
              endsAt = new Date(
                Math.min(
                  auction.endsAt.getTime() +
                    auction.extensionDurationSeconds * 1000,
                  auction.maximumExtendedUntil.getTime(),
                ),
              );
              if (endsAt > auction.endsAt) {
                await tx.auctionExtension.create({
                  data: {
                    auctionId,
                    bidId: bid.id,
                    previousEndsAt: auction.endsAt,
                    newEndsAt: endsAt,
                  },
                });
              }
            }

            await tx.auction.update({
              where: { id: auctionId },
              data: {
                currentAmountMinor: amount,
                currentBidId: bid.id,
                bidCount: { increment: 1 },
                sequence: bidSequence,
                eventSequence,
                endsAt,
                version: { increment: 1 },
              },
            });

            const publicBid = {
              id: bid.id,
              auctionId,
              amountMinor: amount.toString(),
              sequence: bidSequence,
              bidderDisplay: this.maskName(bidder.name),
              acceptedAt: bid.acceptedAt.toISOString(),
              mine: false,
              endsAt: endsAt.toISOString(),
            };
            await tx.outboxEvent.create({
              data: {
                aggregateType: "Auction",
                aggregateId: auctionId,
                eventType: "auction.bid.accepted",
                payload: {
                  type: "auction.bid.accepted",
                  eventId: randomUUID(),
                  auctionId,
                  sequence: eventSequence,
                  serverTime: now.toISOString(),
                  data: publicBid,
                },
              },
            });

            const previousBidderId = auction.currentBid?.bidderId;
            if (previousBidderId && previousBidderId !== userId) {
              const notification = await tx.notification.create({
                data: {
                  userId: previousBidderId,
                  type: "auction.outbid",
                  title: "You have been outbid",
                  body: "A higher bid was accepted. Review the auction before it ends.",
                  data: {
                    auctionId,
                    amountMinor: amount.toString(),
                    sequence: bidSequence,
                  },
                },
              });
              await tx.outboxEvent.create({
                data: {
                  aggregateType: "Notification",
                  aggregateId: notification.id,
                  eventType: "notification.created",
                  payload: {
                    type: "notification.created",
                    userId: previousBidderId,
                    notificationId: notification.id,
                  },
                },
              });
            }

            await tx.auditLog.create({
              data: {
                actorId: userId,
                action: "BID_ACCEPTED",
                entityType: "Auction",
                entityId: auctionId,
                requestId: requestId ?? null,
                after: {
                  amountMinor: amount.toString(),
                  sequence: bidSequence,
                  eventSequence,
                },
              },
            });

            return {
              ...publicBid,
              eventSequence,
              bidderDisplay: "You",
              mine: true,
              duplicate: false,
            };
          },
          {
            isolationLevel: "Serializable",
            maxWait: 5_000,
            timeout: 10_000,
          },
        );
      } catch (error) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS && this.isRetryable(error)) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 25));
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException({
      code: "BID_TRANSACTION_FAILED",
      message: "The bid could not be processed. Please retry.",
    });
  }

  async myBids(userId: string, cursor?: string, limit = 20) {
    const decoded = decodeCursor(cursor, bidCursorSchema);
    const acceptedAt = decoded ? new Date(decoded.acceptedAt) : undefined;
    const rows = await prisma.bid.findMany({
      where: {
        bidderId: userId,
        ...(decoded && acceptedAt
          ? {
              OR: [
                { acceptedAt: { lt: acceptedAt } },
                { acceptedAt, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      take: limit + 1,
      orderBy: [{ acceptedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        auctionId: true,
        amountMinor: true,
        sequence: true,
        acceptedAt: true,
        auction: {
          select: {
            currency: true,
            status: true,
            listing: { select: { title: true, slug: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const items = visible.map((bid) => ({
      id: bid.id,
      auctionId: bid.auctionId,
      title: bid.auction.listing.title,
      slug: bid.auction.listing.slug,
      amountMinor: bid.amountMinor.toString(),
      currency: bid.auction.currency,
      sequence: bid.sequence,
      status: bid.auction.status,
      acceptedAt: bid.acceptedAt.toISOString(),
    }));
    const last = visible.at(-1);

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              acceptedAt: last.acceptedAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async history(id: string, cursor?: string, limit = 30, userId?: string) {
    const auction = await prisma.auction.findUnique({
      where: { id },
      select: { listing: { select: { status: true, createdById: true } } },
    });
    if (
      !auction ||
      (auction.listing.status !== "PUBLISHED" &&
        auction.listing.createdById !== userId)
    ) {
      throw new NotFoundException();
    }

    const decoded = decodeCursor(cursor, historyCursorSchema);
    const rows = await prisma.bid.findMany({
      where: {
        auctionId: id,
        ...(decoded ? { sequence: { lt: decoded.sequence } } : {}),
      },
      take: limit + 1,
      orderBy: { sequence: "desc" },
      select: {
        id: true,
        auctionId: true,
        bidderId: true,
        amountMinor: true,
        sequence: true,
        acceptedAt: true,
        bidder: { select: { name: true } },
      },
    });
    const hasMore = rows.length > limit;
    const visibleRows = rows.slice(0, limit);
    const items = visibleRows.map((bid) => ({
      id: bid.id,
      auctionId: bid.auctionId,
      amountMinor: bid.amountMinor.toString(),
      sequence: bid.sequence,
      bidderDisplay:
        bid.bidderId === userId ? "You" : this.maskName(bid.bidder.name),
      acceptedAt: bid.acceptedAt.toISOString(),
      mine: bid.bidderId === userId,
    }));
    const last = visibleRows.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last ? encodeCursor({ sequence: last.sequence }) : null,
    };
  }

  private assertActiveUser<T extends { banned: boolean; lifecycleStatus: string }>(
    user: T | null,
  ): asserts user is T & { banned: false; lifecycleStatus: "ACTIVE" } {
    if (!user || user.banned || user.lifecycleStatus !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_NOT_ACTIVE",
        message: "Your account is not allowed to participate in auctions.",
      });
    }
  }

  private publicMediaUrl(objectKey: string | null) {
    if (!objectKey) return null;
    return `${apiEnv.CDN_BASE_URL.replace(/\/$/, "")}/${objectKey}`;
  }

  private maskName(name: string) {
    const first = name.trim().charAt(0).toUpperCase() || "B";
    return `${first}***`;
  }

  private isRetryable(error: unknown) {
    const candidate = error as { code?: string; message?: string };
    return (
      candidate.code === "P2034" ||
      candidate.code === "40001" ||
      candidate.code === "40P01" ||
      candidate.message?.includes("could not serialize") === true ||
      candidate.message?.includes("deadlock detected") === true
    );
  }
}
