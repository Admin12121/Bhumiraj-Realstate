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
]);

const imageContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const documentContentTypeSchema = z.union([
  imageContentTypeSchema,
  z.literal("application/pdf"),
]);
const IMAGE_ONLY_PURPOSES = new Set([
  "LISTING_IMAGE",
  "PROFILE_IMAGE",
  "COVER_IMAGE",
  "AGENCY_LOGO",
]);

export const createUploadSchema = z
  .object({
    purpose: mediaPurposeSchema,
    fileName: z.string().trim().min(1).max(200),
    contentType: documentContentTypeSchema,
    size: z.number().int().positive().max(25 * 1024 * 1024),
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
      value.size > 15 * 1024 * 1024
    ) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: "Images must be 15 MB or smaller.",
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
