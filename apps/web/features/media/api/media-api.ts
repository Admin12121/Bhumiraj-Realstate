import {
  createUploadSchema,
  mediaStatusSchema,
  uploadSessionSchema
} from "@real-estate/contracts";
import type { z } from "zod";
import { apiRequest } from "@/shared/http/api";

const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

type UploadContentType = (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

function getUploadContentType(file: File): UploadContentType {
  if (
    ALLOWED_UPLOAD_CONTENT_TYPES.includes(file.type as UploadContentType)
  ) {
    return file.type as UploadContentType;
  }
  throw new Error("Unsupported file type");
}

export function createUpload(input: z.infer<typeof createUploadSchema>) {
  return apiRequest("/media/uploads", {
    method: "POST",
    body: input,
    schema: uploadSessionSchema,
  });
}

export function completeUpload(assetId: string, etag?: string) {
  return apiRequest("/media/uploads/complete", {
    method: "POST",
    body: { assetId, etag },
    schema: mediaStatusSchema.pick({ assetId: true, status: true }),
  });
}

export function getMediaStatus(assetId: string, signal?: AbortSignal) {
  return apiRequest(`/media/uploads/${assetId}`, {
    method: "GET",
    schema: mediaStatusSchema,
    signal,
  });
}

export async function uploadMedia(
  file: File,
  purpose: z.infer<typeof createUploadSchema>["purpose"],
) {
  const contentType = getUploadContentType(file);
  const session = await createUpload({
    purpose,
    fileName: file.name,
    contentType,
    size: file.size,
  });
  const response = await fetch(session.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { ...session.headers, "Content-Type": contentType },
  });
  if (!response.ok) throw new Error("Object storage upload failed");
  await completeUpload(
    session.assetId,
    response.headers.get("etag") ?? undefined,
  );
  return session.assetId;
}

export async function waitForMediaReady(
  assetId: string,
  timeoutMs = 90_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getMediaStatus(assetId);
    if (status.status === "READY") return assetId;
    if (status.status === "REJECTED" || status.status === "DELETED") {
      throw new Error(status.rejectionReason || "Media processing failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Media processing did not finish in time");
}

export async function uploadPropertyImage(file: File) {
  const assetId = await uploadMedia(file, "LISTING_IMAGE");
  return waitForMediaReady(assetId);
}
