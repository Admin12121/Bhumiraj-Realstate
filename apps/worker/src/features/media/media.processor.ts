import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import {
  QUEUES,
  processMediaJobSchema,
  purgePersonalMediaJobSchema,
} from "@real-estate/queue";
import { prisma } from "@real-estate/database";
import { createStorage } from "@real-estate/storage";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { fromBuffer as fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import type { Job } from "bullmq";
import { createHash } from "node:crypto";
import { connect } from "node:net";
import { Readable } from "node:stream";
import { workerEnv } from "../../bootstrap-env";

const PERSONAL_PURPOSES = [
  "PROFILE_IMAGE",
  "COVER_IMAGE",
  "KYC_DOCUMENT",
  "AGENT_LICENSE",
] as const;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

async function streamToBuffer(body: unknown, maximumBytes: number): Promise<Buffer> {
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maximumBytes) {
        throw new Error("Stored object exceeds the permitted media size");
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, total);
  }
  if (
    body &&
    typeof (body as { transformToByteArray?: () => Promise<Uint8Array> })
      .transformToByteArray === "function"
  ) {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    if (bytes.byteLength > maximumBytes) {
      throw new Error("Stored object exceeds the permitted media size");
    }
    return Buffer.from(bytes);
  }
  throw new Error("Unsupported object-storage response body");
}

function clamavFrame(payload: Buffer): Buffer {
  const size = Buffer.allocUnsafe(4);
  size.writeUInt32BE(payload.length, 0);
  return Buffer.concat([size, payload]);
}

async function scanWithClamAv(source: Buffer): Promise<void> {
  const host = workerEnv.CLAMAV_HOST;
  if (!host) {
    if (workerEnv.NODE_ENV === "production") {
      throw new Error("CLAMAV_HOST is required in production");
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port: workerEnv.CLAMAV_PORT });
    const responseChunks: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      socket.destroy(new Error("ClamAV scan timed out"));
    }, workerEnv.CLAMAV_TIMEOUT_MS);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    const evaluate = () => {
      const response = Buffer.concat(responseChunks)
        .toString("utf8")
        .replace(/\0/g, "")
        .trim();
      if (!response) return false;
      if (response.endsWith("OK")) {
        finish();
        return true;
      }
      if (response.includes("FOUND")) {
        finish(new Error(`Malware detected: ${response}`));
        return true;
      }
      finish(new Error(`Unexpected ClamAV response: ${response}`));
      return true;
    };

    socket.once("error", (error) => finish(error));
    socket.on("data", (chunk: Buffer) => {
      responseChunks.push(chunk);
      evaluate();
    });
    socket.once("end", () => {
      if (!evaluate()) finish(new Error("Unexpected ClamAV response: empty"));
    });

    socket.once("connect", () => {
      socket.write(Buffer.from("zINSTREAM\0", "utf8"));
      const chunkSize = 256 * 1024;
      for (let offset = 0; offset < source.length; offset += chunkSize) {
        socket.write(clamavFrame(source.subarray(offset, offset + chunkSize)));
      }
      // Terminator only. Half-closing here instead makes clamd treat the
      // connection as abandoned and drop the scan without ever replying.
      socket.write(Buffer.alloc(4));
    });
  });
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "application/pdf":
      return "pdf";
    default:
      throw new Error("Unsupported detected media type");
  }
}

async function sanitizeImage(source: Buffer, mime: string): Promise<Buffer> {
  const pipeline = sharp(source, { failOn: "error", limitInputPixels: 80_000_000 })
    .rotate();
  switch (mime) {
    case "image/jpeg":
      return pipeline.jpeg({ quality: 94, mozjpeg: true }).toBuffer();
    case "image/png":
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case "image/webp":
      return pipeline.webp({ quality: 92, effort: 4 }).toBuffer();
    case "image/avif":
      return pipeline.avif({ quality: 82, effort: 5 }).toBuffer();
    default:
      throw new Error("Unsupported image type");
  }
}

@Processor(QUEUES.MEDIA, { concurrency: 4 })
export class MediaProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessor.name);
  private readonly storage = createStorage({
    ...(workerEnv.S3_ENDPOINT === undefined
      ? {}
      : { endpoint: workerEnv.S3_ENDPOINT }),
    ...(workerEnv.S3_PUBLIC_ENDPOINT === undefined
      ? {}
      : { publicEndpoint: workerEnv.S3_PUBLIC_ENDPOINT }),
    region: workerEnv.S3_REGION,
    accessKeyId: workerEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: workerEnv.S3_SECRET_ACCESS_KEY,
    forcePathStyle: workerEnv.S3_FORCE_PATH_STYLE,
  });

  async process(job: Job): Promise<void> {
    if (job.name === "purge-personal") {
      const { userId } = purgePersonalMediaJobSchema.parse(job.data);
      await this.purgePersonalMedia(userId);
      return;
    }

    const { assetId } = processMediaJobSchema.parse(job.data);
    await this.processAsset(assetId);
  }

  private async processAsset(assetId: string): Promise<void> {
    const asset = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: assetId },
    });
    if (asset.status === "READY" || asset.status === "DELETED") return;

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { status: "PROCESSING", rejectionReason: null },
    });

    const temporaryKey = asset.objectKey;
    const writtenObjects: Array<{ bucket: string; key: string }> = [];

    try {
      const response = await this.storage.client.send(
        new GetObjectCommand({ Bucket: asset.bucket, Key: temporaryKey }),
      );
      const expectedMaximum = Math.min(
        MAX_MEDIA_BYTES,
        Number(asset.sizeBytes) + 1,
      );
      const source = await streamToBuffer(response.Body, expectedMaximum);
      if (BigInt(source.length) !== asset.sizeBytes) {
        throw new Error("Stored object size does not match the upload session");
      }

      await scanWithClamAv(source);

      const detected = await fileTypeFromBuffer(source);
      if (!detected) throw new Error("Uploaded file type could not be verified");
      const extension = extensionForMime(detected.mime);
      const finalKey = `private/${asset.purpose.toLowerCase()}/${asset.ownerId}/${asset.id}/original.${extension}`;
      const isPdf = detected.mime === "application/pdf";

      if (isPdf && asset.visibility !== "PRIVATE") {
        throw new Error("PDF files are allowed only for private documents");
      }
      if (!isPdf && !detected.mime.startsWith("image/")) {
        throw new Error("Uploaded file is not a supported image or PDF document");
      }

      let normalizedSource = source;
      let width: number | undefined;
      let height: number | undefined;
      if (!isPdf) {
        const metadata = await sharp(source, {
          failOn: "error",
          limitInputPixels: 80_000_000,
        }).metadata();
        if (!metadata.width || !metadata.height) {
          throw new Error("Invalid image dimensions");
        }
        width = metadata.width;
        height = metadata.height;
        normalizedSource = await sanitizeImage(source, detected.mime);
      }

      await this.storage.client.send(
        new PutObjectCommand({
          Bucket: workerEnv.S3_PRIVATE_BUCKET,
          Key: finalKey,
          Body: normalizedSource,
          ContentType: detected.mime,
          CacheControl: "private,no-store",
        }),
      );
      writtenObjects.push({ bucket: workerEnv.S3_PRIVATE_BUCKET, key: finalKey });

      const variants: Array<{
        name: string;
        objectKey: string;
        contentType: string;
        body: Buffer;
        width?: number;
        height?: number;
      }> = [];

      if (asset.visibility === "PUBLIC" && !isPdf) {
        // AVIF throughout: roughly half the bytes of WebP at the same quality,
        // and every browser this app supports decodes it. Quality rises with
        // size so a card stays small while the full view stays sharp.
        //
        // These sit deliberately high. Property photography is the product, and
        // AVIF in the high 70s/80s is visually hard to separate from source
        // while still landing well under an equivalent JPEG.
        const variantSpecs = [
          { name: "thumb", width: 480, quality: 68 },
          { name: "card", width: 1200, quality: 80 },
          { name: "large", width: 2048, quality: 86 },
          { name: "full", width: 3200, quality: 90 },
        ];
        const baseKey = `media/${asset.purpose.toLowerCase()}/${asset.ownerId}/${asset.id}`;

        for (const variant of variantSpecs) {
          const body = await sharp(normalizedSource, {
            failOn: "error",
            limitInputPixels: 80_000_000,
          })
            .resize({ width: variant.width, withoutEnlargement: true })
            .avif({ quality: variant.quality, effort: 5 })
            .toBuffer();
          const objectKey = `${baseKey}/${variant.name}.avif`;
          const contentType = "image/avif";
          await this.storage.client.send(
            new PutObjectCommand({
              Bucket: workerEnv.S3_PUBLIC_BUCKET,
              Key: objectKey,
              Body: body,
              ContentType: contentType,
              CacheControl: "public,max-age=31536000,immutable",
            }),
          );
          writtenObjects.push({ bucket: workerEnv.S3_PUBLIC_BUCKET, key: objectKey });
          const metadata = await sharp(body).metadata();
          variants.push({
            name: variant.name,
            objectKey,
            contentType,
            body,
            width: metadata.width,
            height: metadata.height,
          });
        }
      }

      // A 20px AVIF is ~300 bytes; inlining it avoids a request just to show
      // a placeholder, and it is small enough to sit in a row comfortably.
      let blurDataUrl: string | null = null;
      if (!isPdf) {
        try {
          const blur = await sharp(normalizedSource, {
            failOn: "error",
            limitInputPixels: 80_000_000,
          })
            .resize({ width: 20, withoutEnlargement: true })
            .avif({ quality: 40, effort: 2 })
            .toBuffer();
          const encoded = `data:image/avif;base64,${blur.toString("base64")}`;
          if (encoded.length <= 4000) blurDataUrl = encoded;
        } catch (error) {
          // A missing placeholder must never fail the upload itself.
          this.logger.warn(
            `Blur placeholder failed for ${asset.id}: ${String(error)}`,
          );
        }
      }

      const checksum = createHash("sha256")
        .update(normalizedSource)
        .digest("hex");

      await prisma.$transaction(async (tx) => {
        for (const variant of variants) {
          await tx.mediaVariant.upsert({
            where: {
              mediaAssetId_name: {
                mediaAssetId: asset.id,
                name: variant.name,
              },
            },
            update: {
              objectKey: variant.objectKey,
              contentType: variant.contentType,
              sizeBytes: BigInt(variant.body.length),
              width: variant.width ?? null,
              height: variant.height ?? null,
            },
            create: {
              mediaAssetId: asset.id,
              name: variant.name,
              objectKey: variant.objectKey,
              contentType: variant.contentType,
              sizeBytes: BigInt(variant.body.length),
              width: variant.width ?? null,
              height: variant.height ?? null,
            },
          });
        }

        await tx.mediaAsset.update({
          where: { id: asset.id },
          data: {
            status: "READY",
            bucket: workerEnv.S3_PRIVATE_BUCKET,
            objectKey: finalKey,
            checksum,
            sizeBytes: BigInt(normalizedSource.length),
            width: width ?? null,
            height: height ?? null,
            readyAt: new Date(),
            contentType: detected.mime,
            blurDataUrl,
          },
        });
      });

      await this.deleteObject(asset.bucket, temporaryKey);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Media processing failed";
      this.logger.error({ assetId, message });
      await Promise.allSettled([
        this.deleteObject(asset.bucket, temporaryKey),
        ...writtenObjects.map(({ bucket, key }) => this.deleteObject(bucket, key)),
      ]);
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: "REJECTED",
          rejectionReason: message.slice(0, 1_000),
        },
      });
      throw error;
    }
  }

  private async purgePersonalMedia(userId: string): Promise<void> {
    const assets = await prisma.mediaAsset.findMany({
      where: {
        ownerId: userId,
        purpose: { in: [...PERSONAL_PURPOSES] },
        status: { not: "DELETED" },
      },
      select: {
        id: true,
        bucket: true,
        objectKey: true,
        visibility: true,
        variants: { select: { objectKey: true } },
      },
      take: 100,
    });

    for (const asset of assets) {
      const deletions = [
        this.deleteObject(asset.bucket, asset.objectKey),
        ...asset.variants.map((variant) =>
          this.deleteObject(
            asset.visibility === "PUBLIC"
              ? workerEnv.S3_PUBLIC_BUCKET
              : workerEnv.S3_PRIVATE_BUCKET,
            variant.objectKey,
          ),
        ),
      ];
      const results = await Promise.allSettled(deletions);
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: "DELETED", rejectionReason: null },
      });
    }
  }

  private async deleteObject(bucket: string, key: string): Promise<void> {
    await this.storage.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
  }
}
