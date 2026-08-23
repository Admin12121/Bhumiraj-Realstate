import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { createStorage } from "@real-estate/storage";
import { prisma } from "@real-estate/database";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { createUploadSchema } from "@real-estate/contracts";
import { Queue } from "bullmq";
import { QUEUES } from "@real-estate/queue";
import { createRedis } from "@real-estate/redis";
import { assertActiveAccount } from "../../shared/auth/account-policy";
import { apiEnv } from "../../bootstrap-env";
import { StaffAccessService } from "../../shared/auth/staff-access.service";
import { ADMIN_PERMISSIONS } from "../admin/admin.permissions";

const PRIVATE_PURPOSES = new Set([
  "OWNERSHIP_DOCUMENT",
  "KYC_DOCUMENT",
  "AGENT_LICENSE",
  "MESSAGE_ATTACHMENT",
  // A payment receipt shows an account number and often a balance. It was
  // being copied to the public CDN, where anyone with the URL could read it.
  "PAYMENT_PROOF",
]);

const MAX_ACTIVE_UPLOADS_PER_USER = 20;
const MAX_DAILY_UPLOADS_PER_USER = 200;
const MAX_DAILY_UPLOAD_BYTES_PER_USER = 500n * 1024n * 1024n;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

@Injectable()
export class MediaService implements OnModuleDestroy {
  constructor(private readonly staffAccessService: StaffAccessService) {}

  private readonly redis = createRedis(apiEnv.REDIS_CRITICAL_URL, "critical");
  private readonly storage = createStorage({
    ...(apiEnv.S3_ENDPOINT === undefined ? {} : { endpoint: apiEnv.S3_ENDPOINT }),
    ...(apiEnv.S3_PUBLIC_ENDPOINT === undefined
      ? {}
      : { publicEndpoint: apiEnv.S3_PUBLIC_ENDPOINT }),
    region: apiEnv.S3_REGION,
    accessKeyId: apiEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: apiEnv.S3_SECRET_ACCESS_KEY,
    forcePathStyle: apiEnv.S3_FORCE_PATH_STYLE,
  });
  private readonly queue = new Queue(QUEUES.MEDIA, {
    connection: this.redis,
  });

  async create(userId: string, input: z.infer<typeof createUploadSchema>) {
    // Not gated on verification: a new customer setting a profile photo has no
    // reason to open their inbox first. The actions that matter — creating a
    // listing, bidding — check verification themselves.
    await assertActiveAccount(userId);
    const isPrivate = PRIVATE_PURPOSES.has(input.purpose);
    // Originals always land in the private quarantine bucket. Public CDN
    // objects are created only by the trusted media worker after validation.
    const bucket = apiEnv.S3_PRIVATE_BUCKET;
    const extension = EXTENSION_BY_CONTENT_TYPE[input.contentType];
    if (!extension) {
      throw new ConflictException({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "This media type is not supported.",
      });
    }

    const id = randomUUID();
    const objectKey = `uploads/${input.purpose.toLowerCase()}/${userId}/${id}/upload.${extension}`;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const asset = await prisma.$transaction(async (tx) => {
      // Serialize quota checks for one account so concurrent upload-session
      // creation cannot bypass active/daily limits.
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`media-upload:${userId}`}, 0)
        )::text AS lock_result
      `;

      const [activeUploads, dailyUsage] = await Promise.all([
        tx.mediaAsset.count({
          where: {
            ownerId: userId,
            createdAt: { gte: since },
            status: { in: ["UPLOADING", "UPLOADED", "PROCESSING"] },
          },
        }),
        tx.mediaAsset.aggregate({
          where: { ownerId: userId, createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { sizeBytes: true },
        }),
      ]);

      if (activeUploads >= MAX_ACTIVE_UPLOADS_PER_USER) {
        throw new ConflictException({
          code: "TOO_MANY_ACTIVE_UPLOADS",
          message: "Finish or wait for existing uploads before starting another.",
        });
      }
      if (dailyUsage._count._all >= MAX_DAILY_UPLOADS_PER_USER) {
        throw new ConflictException({
          code: "DAILY_UPLOAD_LIMIT_REACHED",
          message: "The daily upload-count limit has been reached.",
        });
      }
      const usedBytes = dailyUsage._sum.sizeBytes ?? 0n;
      if (usedBytes + BigInt(input.size) > MAX_DAILY_UPLOAD_BYTES_PER_USER) {
        throw new ConflictException({
          code: "DAILY_UPLOAD_BYTES_REACHED",
          message: "The daily upload-size limit has been reached.",
        });
      }

      return tx.mediaAsset.create({
        data: {
          id,
          ownerId: userId,
          purpose: input.purpose,
          visibility: isPrivate ? "PRIVATE" : "PUBLIC",
          bucket,
          objectKey,
          originalFileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: BigInt(input.size),
        },
      });
    });

    try {
      const uploadUrl = await this.storage.createUploadUrl(
        bucket,
        objectKey,
        input.contentType,
      );
      return {
        assetId: asset.id,
        uploadUrl,
        headers: { "Content-Type": input.contentType },
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      };
    } catch (error) {
      await prisma.mediaAsset
        .update({
          where: { id: asset.id },
          data: {
            status: "REJECTED",
            rejectionReason: "Unable to create object-storage upload session.",
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async complete(userId: string, assetId: string, etag?: string) {
    await assertActiveAccount(userId);
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId },
    });
    if (!asset) throw new NotFoundException();

    if (["UPLOADED", "PROCESSING", "READY"].includes(asset.status)) {
      return { assetId: asset.id, status: asset.status };
    }
    if (asset.status !== "UPLOADING") {
      throw new ConflictException({
        code: "INVALID_MEDIA_STATE",
        message: "The upload cannot be finalized in its current state.",
      });
    }

    const metadata = await this.storage.head(asset.bucket, asset.objectKey);
    if (
      metadata.ContentLength !== undefined &&
      BigInt(metadata.ContentLength) !== asset.sizeBytes
    ) {
      throw new ConflictException({
        code: "MEDIA_SIZE_MISMATCH",
        message: "Uploaded object size does not match the declared size.",
      });
    }
    if (metadata.ContentType && metadata.ContentType !== asset.contentType) {
      throw new ConflictException({
        code: "MEDIA_CONTENT_TYPE_MISMATCH",
        message: "Uploaded object type does not match the declared type.",
      });
    }
    if (etag && metadata.ETag) {
      const normalizedReceived = etag.replaceAll('"', "");
      const normalizedStored = metadata.ETag.replaceAll('"', "");
      if (normalizedReceived !== normalizedStored) {
        throw new ConflictException({
          code: "MEDIA_ETAG_MISMATCH",
          message: "Uploaded object integrity metadata does not match.",
        });
      }
    }

    const transitioned = await prisma.mediaAsset.updateMany({
      where: { id: asset.id, ownerId: userId, status: "UPLOADING" },
      data: { status: "UPLOADED" },
    });
    if (transitioned.count === 0) {
      const current = await prisma.mediaAsset.findUnique({
        where: { id: asset.id },
        select: { status: true },
      });
      if (current && ["UPLOADED", "PROCESSING", "READY"].includes(current.status)) {
        return { assetId: asset.id, status: current.status };
      }
      throw new ConflictException({
        code: "MEDIA_STATE_CHANGED",
        message: "The upload state changed while it was being finalized.",
      });
    }
    await this.queue.add(
      "process",
      { assetId: asset.id },
      {
        jobId: asset.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
    return { assetId: asset.id, status: "UPLOADED" };
  }

  async status(userId: string, assetId: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, ownerId: userId },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        readyAt: true,
      },
    });
    if (!asset) throw new NotFoundException();
    return {
      assetId: asset.id,
      status: asset.status,
      rejectionReason: asset.rejectionReason,
      readyAt: asset.readyAt?.toISOString() ?? null,
    };
  }


  async download(userId: string, sessionId: string | undefined, assetId: string) {
    const [user, asset] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, banned: true, lifecycleStatus: true },
      }),
      prisma.mediaAsset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          status: true,
          bucket: true,
          objectKey: true,
          propertyDocument: {
            select: { property: { select: { ownerId: true } } },
          },
          messageAttachments: {
            where: {
              message: {
                conversation: { participants: { some: { userId } } },
              },
            },
            take: 1,
            select: { id: true },
          },
        },
      }),
    ]);
    if (
      !user ||
      user.banned ||
      user.lifecycleStatus !== "ACTIVE" ||
      !asset ||
      asset.status !== "READY"
    ) {
      throw new NotFoundException();
    }

    const staffAccess =
      user.role === "OWNER" || user.role === "STAFF"
        ? await this.staffAccessService.resolve(userId, sessionId)
        : null;
    const strongAuthentication =
      apiEnv.E2E_MODE ||
      staffAccess?.authMethod === "credential+2fa" ||
      staffAccess?.authMethod === "passkey";
    const elevated = Boolean(
      staffAccess &&
        strongAuthentication &&
        this.staffAccessService.hasPermission(
          staffAccess,
          ADMIN_PERMISSIONS.PRIVATE_MEDIA_READ,
        ),
    );
    const authorized =
      asset.visibility === "PUBLIC" ||
      asset.ownerId === userId ||
      asset.propertyDocument?.property.ownerId === userId ||
      asset.messageAttachments.length > 0 ||
      elevated;
    if (!authorized) throw new NotFoundException();

    const expiresIn = 300;
    const url = await this.storage.createDownloadUrl(
      asset.bucket,
      asset.objectKey,
      expiresIn,
    );
    return {
      assetId: asset.id,
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.redis.quit().catch(() => undefined);
  }
}
