import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@real-estate/database";
import { z } from "zod";
import { publicAgentsQuerySchema, updateProfileSchema } from "@real-estate/contracts";
import { assertActiveAccount } from "../../shared/auth/account-policy";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";
import { apiEnv } from "../../bootstrap-env";

@Injectable()
export class ProfilesService {
  async listAgents(
    query: z.infer<typeof publicAgentsQuerySchema>,
    viewerId?: string,
  ) {
    const cursor = decodeCursor(
      query.cursor,
      z.object({
        averageRating: z.string().regex(/^\d+(?:\.\d+)?$/),
        reviewCount: z.number().int().nonnegative(),
        id: z.uuid(),
      }),
    );
    const search = query.search?.trim();
    const where = {
      verifiedAt: { not: null },
      user: {
        lifecycleStatus: "ACTIVE" as const,
        banned: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { profile: { is: { username: { contains: search, mode: "insensitive" as const } } } },
              ],
            }
          : {}),
      },
      ...(cursor
        ? {
            OR: [
              { averageRating: { lt: cursor.averageRating } },
              {
                averageRating: cursor.averageRating,
                reviewCount: { lt: cursor.reviewCount },
              },
              {
                averageRating: cursor.averageRating,
                reviewCount: cursor.reviewCount,
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    };

    const rows = await prisma.agentProfile.findMany({
      where,
      orderBy: [
        { averageRating: "desc" },
        { reviewCount: "desc" },
        { id: "desc" },
      ],
      take: query.limit + 1,
      select: {
        id: true,
        userId: true,
        headline: true,
        about: true,
        verifiedAt: true,
        averageRating: true,
        reviewCount: true,
        user: {
          select: {
            name: true,
            image: true,
            profile: { select: { username: true } },
            _count: {
              select: {
                listings: { where: { status: "PUBLISHED" } },
                followedBy: true,
              },
            },
            followedBy: viewerId
              ? {
                  where: { followerId: viewerId },
                  select: { followerId: true },
                  take: 1,
                }
              : false,
          },
        },
      },
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        name: row.user.name,
        username: row.user.profile?.username ?? null,
        image: row.user.image,
        headline: row.headline,
        about: row.about,
        verified: Boolean(row.verifiedAt),
        averageRating: Number(row.averageRating),
        reviewCount: row.reviewCount,
        listingCount: row.user._count.listings,
        followerCount: row.user._count.followedBy,
        followedByMe:
          Array.isArray(row.user.followedBy) && row.user.followedBy.length > 0,
      })),
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              averageRating: last.averageRating.toString(),
              reviewCount: last.reviewCount,
              id: last.id,
            })
          : null,
    };
  }

  async get(userId: string, viewerId?: string, includePrivate = false) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        ...(includePrivate ? {} : { lifecycleStatus: "ACTIVE", banned: false }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        createdAt: true,
        profile: true,
        _count: {
          select: {
            listings: { where: { status: "PUBLISHED" } },
            favorites: true,
            follows: true,
            followedBy: true,
          },
        },
        followedBy: viewerId
          ? {
              where: { followerId: viewerId },
              select: { followerId: true },
              take: 1,
            }
          : false,
      },
    });

    if (!user) throw new NotFoundException();

    const isSelf = viewerId === user.id;
    return {
      id: user.id,
      name: user.name,
      username: user.profile?.username ?? null,
      ...(includePrivate ? { email: user.email } : {}),
      image: user.image,
      coverImage: user.profile?.coverImageUrl ?? null,
      bio: user.profile?.bio ?? null,
      ...(includePrivate ? { phone: user.profile?.phone ?? null } : {}),
      role: user.role,
      verified: user.emailVerified,
      isSelf,
      followedByMe:
        !isSelf && Array.isArray(user.followedBy) && user.followedBy.length > 0,
      joinedAt: user.createdAt.toISOString(),
      stats: {
        listings: user._count.listings,
        followers: user._count.followedBy,
        following: user._count.follows,
        ...(includePrivate ? { saved: user._count.favorites } : {}),
      },
    };
  }

  async update(userId: string, input: z.infer<typeof updateProfileSchema>) {
    await assertActiveAccount(userId);
    const [imageAsset, coverAsset] = await Promise.all([
      input.imageAssetId
        ? this.profileAsset(input.imageAssetId, userId, ["PROFILE_IMAGE"])
        : Promise.resolve(null),
      input.coverAssetId
        ? this.profileAsset(input.coverAssetId, userId, ["COVER_IMAGE"])
        : Promise.resolve(null),
    ]);

    const userData = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.imageAssetId !== undefined
        ? { image: imageAsset ? this.mediaUrl(imageAsset.objectKey) : null }
        : {}),
    };
    const profileData = {
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.coverAssetId !== undefined
        ? {
            coverImageUrl: coverAsset
              ? this.mediaUrl(coverAsset.objectKey)
              : null,
          }
        : {}),
    };

    try {
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: userData }),
        prisma.userProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        }),
        prisma.auditLog.create({
          data: {
            actorId: userId,
            action: "PROFILE_UPDATED",
            entityType: "User",
            entityId: userId,
          },
        }),
      ]);
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException({
          code: "PROFILE_VALUE_TAKEN",
          message: "That username or phone number is already in use.",
        });
      }
      throw error;
    }

    return this.get(userId, userId, true);
  }

  async follow(targetUserId: string, followerId: string) {
    await assertActiveAccount(followerId);
    if (targetUserId === followerId) {
      throw new BadRequestException({
        code: "SELF_FOLLOW",
        message: "You cannot follow your own profile.",
      });
    }

    const target = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        lifecycleStatus: "ACTIVE",
        banned: false,
      },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();

    const followerCount = await prisma.$transaction(async (tx) => {
      await tx.agentFollow.upsert({
        where: {
          followerId_agentUserId: {
            followerId,
            agentUserId: targetUserId,
          },
        },
        create: { followerId, agentUserId: targetUserId },
        update: {},
      });
      return tx.agentFollow.count({ where: { agentUserId: targetUserId } });
    });

    return { followed: true, followerCount };
  }

  async unfollow(targetUserId: string, followerId: string) {
    await assertActiveAccount(followerId);
    if (targetUserId === followerId) {
      throw new BadRequestException({
        code: "SELF_FOLLOW",
        message: "You cannot unfollow your own profile.",
      });
    }

    const result = await prisma.agentFollow.deleteMany({
      where: { followerId, agentUserId: targetUserId },
    });
    if (result.count === 0) {
      const target = await prisma.user.findFirst({
        where: { id: targetUserId, lifecycleStatus: "ACTIVE", banned: false },
        select: { id: true },
      });
      if (!target) throw new NotFoundException();
    }

    const followerCount = await prisma.agentFollow.count({
      where: { agentUserId: targetUserId },
    });
    return { followed: false, followerCount };
  }

  private async profileAsset(
    assetId: string,
    ownerId: string,
    purposes: Array<"PROFILE_IMAGE" | "COVER_IMAGE">,
  ) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: assetId,
        ownerId,
        purpose: { in: purposes },
        visibility: "PUBLIC",
        status: "READY",
      },
      select: {
        objectKey: true,
        variants: {
          where: { name: { in: ["profile", "card", "large"] } },
          orderBy: { name: "asc" },
          take: 1,
          select: { objectKey: true },
        },
      },
    });
    if (!asset) {
      throw new BadRequestException({
        code: "PROFILE_MEDIA_NOT_READY",
        message: "The selected profile image is unavailable or still processing.",
      });
    }
    return { objectKey: asset.variants[0]?.objectKey ?? asset.objectKey };
  }

  private mediaUrl(objectKey: string) {
    return `${apiEnv.CDN_BASE_URL.replace(/\/$/, "")}/${objectKey}`;
  }

  private isUniqueConstraint(error: unknown) {
    return Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "P2002",
    );
  }
}
