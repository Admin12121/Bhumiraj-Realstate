import { z } from "zod";
import { idSchema, isoDateSchema } from "./common";

export const mediaPurposeSchema = z.enum([
  "LISTING_IMAGE",
  "PROFILE_IMAGE",
  "COVER_IMAGE",
  "OWNERSHIP_DOCUMENT",
  "KYC_DOCUMENT",
  "AGENT_LICENSE",
  "AGENCY_LOGO",
  "MESSAGE_ATTACHMENT",
  "PAYMENT_PROOF",
]);

/** Upload ceilings. Images are re-encoded to AVIF after upload. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const imageContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const videoContentTypeSchema = z.enum([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const documentContentTypeSchema = z.union([
  imageContentTypeSchema,
  videoContentTypeSchema,
  z.literal("application/pdf"),
]);
const IMAGE_ONLY_PURPOSES = new Set([
  "PROFILE_IMAGE",
  "COVER_IMAGE",
  "AGENCY_LOGO",
  "PAYMENT_PROOF",
]);

export const createUploadSchema = z
  .object({
    purpose: mediaPurposeSchema,
    fileName: z.string().trim().min(1).max(200),
    contentType: documentContentTypeSchema,
    size: z.number().int().positive().max(MAX_VIDEO_BYTES),
  })
  .superRefine((value, context) => {
    if (
      IMAGE_ONLY_PURPOSES.has(value.purpose) &&
      value.contentType === "application/pdf"
    ) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: "This upload purpose accepts images only.",
      });
    }
    if (
      value.contentType.startsWith("image/") &&
      value.size > MAX_IMAGE_BYTES
    ) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: "Images must be 50 MB or smaller.",
      });
    }
    if (
      value.contentType.startsWith("video/") &&
      value.size > MAX_VIDEO_BYTES
    ) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: "Videos must be 500 MB or smaller.",
      });
    }
    // Video belongs to listings only; documents and avatars stay still images.
    if (
      value.contentType.startsWith("video/") &&
      value.purpose !== "LISTING_IMAGE" &&
      value.purpose !== "MESSAGE_ATTACHMENT"
    ) {
      context.addIssue({
        code: "custom",
        path: ["contentType"],
        message: "Video is not accepted for this upload purpose.",
      });
    }
  });

export const uploadSessionSchema = z.object({
  assetId: idSchema,
  uploadUrl: z.string().url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime({ offset: true }),
});

export const completeUploadSchema = z.object({
  assetId: idSchema,
  etag: z.string().max(200).optional(),
});

export const mediaStatusSchema = z.object({
  assetId: idSchema,
  status: z.enum([
    "UPLOADING",
    "UPLOADED",
    "PROCESSING",
    "READY",
    "REJECTED",
    "DELETED",
  ]),
  rejectionReason: z.string().nullable(),
  readyAt: isoDateSchema.nullable(),
});

export const mediaDownloadSchema = z.object({
  assetId: idSchema,
  url: z.string().url(),
  expiresAt: z.iso.datetime({ offset: true }),
});
