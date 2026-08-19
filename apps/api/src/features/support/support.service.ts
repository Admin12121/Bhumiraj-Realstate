import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@real-estate/database";
import {
  ANONYMOUS_THREAD_TTL_MINUTES,
  SUPPORT_ATTACHMENT_MAX_BYTES,
} from "@real-estate/contracts";
import { apiEnv } from "../../bootstrap-env";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";
import { inspectMessage } from "./message-safety";

type AttachmentRow = {
  objectKey: string;
  variants: { name: string; objectKey: string }[];
} | null;

/**
 * Prefers the processed `card` variant so a chat bubble does not pull a
 * full-resolution original.
 */
function attachmentUrl(attachment: AttachmentRow): string | null {
  if (!attachment) return null;
  const key =
    attachment.variants.find((variant) => variant.name === "card")?.objectKey ??
    attachment.objectKey;
  return `${apiEnv.CDN_BASE_URL.replace(/\/$/, "")}/${key}`;
}

const threadCursorSchema = z
  .object({ lastMessageAt: z.iso.datetime({ offset: true }), id: z.uuid() })
  .strict();

const TTL_MS = ANONYMOUS_THREAD_TTL_MINUTES * 60 * 1000;

@Injectable()
export class SupportService {
  /** Opaque, unguessable, and unrelated to any device characteristic. */
  createVisitorKey(): string {
    return randomBytes(24).toString("base64url");
  }

  private slidingExpiry(isAnonymous: boolean): Date | null {
    return isAnonymous ? new Date(Date.now() + TTL_MS) : null;
  }

  /**
   * Resolves the caller's thread, creating one on demand. A signed-in caller
   * always uses their account thread; signing in adopts the anonymous thread so
   * the conversation is not lost at the moment someone registers.
   */
  async resolveThread(visitorKey: string | null, userId?: string) {
    if (userId) {
      const adopted = visitorKey
        ? await prisma.supportThread.findUnique({
            where: { visitorKey },
            select: { id: true, userId: true },
          })
        : null;

      // Claim the guest thread for the account it just signed into.
      if (adopted && !adopted.userId) {
        return prisma.supportThread.update({
          where: { id: adopted.id },
          data: { userId, visitorKey: null, expiresAt: null },
          select: { id: true },
        });
      }

      const existing = await prisma.supportThread.findFirst({
        where: { userId, status: { not: "CLOSED" } },
        orderBy: { lastMessageAt: "desc" },
        select: { id: true },
      });
      if (existing) return existing;

      return prisma.supportThread.create({
        data: { userId },
        select: { id: true },
      });
    }

    if (!visitorKey) return null;

    const existing = await prisma.supportThread.findUnique({
      where: { visitorKey },
      select: { id: true },
    });
    if (existing) return existing;

    return prisma.supportThread.create({
      data: { visitorKey, expiresAt: this.slidingExpiry(true) },
      select: { id: true },
    });
  }

  async getThread(visitorKey: string | null, userId?: string) {
    const thread = await this.resolveThread(visitorKey, userId);
    if (!thread) return null;

    const row = await prisma.supportThread.findUnique({
      where: { id: thread.id },
      select: {
        id: true,
        status: true,
        subject: true,
        expiresAt: true,
        lastMessageAt: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 100,
          select: {
            id: true,
            authorRole: true,
            body: true,
            createdAt: true,
            author: { select: { name: true } },
            attachment: {
              select: {
                objectKey: true,
                variants: { select: { name: true, objectKey: true } },
              },
            },
          },
        },
      },
    });
    if (!row) return null;

    return {
      id: row.id,
      status: row.status,
      subject: row.subject,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      lastMessageAt: row.lastMessageAt.toISOString(),
      messages: row.messages.map((message) => ({
        id: message.id,
        authorRole: message.authorRole,
        authorName: message.author?.name ?? null,
        body: message.body,
        attachmentUrl: attachmentUrl(message.attachment),
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  /** Visitor-side send. Each message slides the anonymous expiry window. */
  /**
   * An attachment must already be a READY image owned by the sender. READY is
   * the important part: the media worker only sets it after the ClamAV scan and
   * re-encode succeed, so an unscanned or infected upload can never be attached.
   */
  private async resolveAttachment(
    assetId: string,
    userId?: string,
  ): Promise<string> {
    if (!userId) {
      throw new ForbiddenException({
        code: "SIGN_IN_TO_ATTACH",
        message: "Sign in to send an image.",
      });
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        purpose: true,
        contentType: true,
        sizeBytes: true,
      },
    });
    if (!asset) throw new NotFoundException();

    if (asset.ownerId !== userId) {
      throw new ForbiddenException({
        code: "NOT_YOUR_UPLOAD",
        message: "That file belongs to another account.",
      });
    }
    if (asset.purpose !== "MESSAGE_ATTACHMENT") {
      throw new ConflictException({
        code: "WRONG_PURPOSE",
        message: "That file was not uploaded as a message attachment.",
      });
    }
    if (asset.status !== "READY") {
      throw new ConflictException({
        code: "ATTACHMENT_NOT_READY",
        message:
          "The image is still being scanned. Try again in a few seconds.",
      });
    }
    if (!asset.contentType.startsWith("image/")) {
      throw new ConflictException({
        code: "IMAGES_ONLY",
        message: "Only images can be attached to a chat message.",
      });
    }
    if (asset.sizeBytes > BigInt(SUPPORT_ATTACHMENT_MAX_BYTES)) {
      throw new ConflictException({
        code: "ATTACHMENT_TOO_LARGE",
        message: "Attach an image under 10MB.",
      });
    }

    return asset.id;
  }

  async sendVisitorMessage(
    visitorKey: string | null,
    body: string,
    userId?: string,
    attachmentId?: string,
  ) {
    const thread = await this.resolveThread(visitorKey, userId);
    if (!thread) throw new NotFoundException();

    const attachment = attachmentId
      ? await this.resolveAttachment(attachmentId, userId)
      : null;

    // Flagged, not blocked: a real enquiry often carries a phone number.
    const { flaggedReason } = inspectMessage(body);

    return prisma.$transaction(async (tx) => {
      const message = await tx.supportMessage.create({
        data: {
          threadId: thread.id,
          authorRole: "VISITOR",
          authorId: userId ?? null,
          body,
          attachmentId: attachment,
          flaggedReason,
        },
        select: { id: true, createdAt: true },
      });

      await tx.supportThread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: message.createdAt,
          ...(userId ? {} : { expiresAt: new Date(Date.now() + TTL_MS) }),
        },
      });

      return { id: message.id, createdAt: message.createdAt.toISOString() };
    });
  }

  async listThreads(query: {
    status?: string | undefined;
    mine?: boolean | undefined;
    cursor?: string | undefined;
    limit: number;
  }, staffId: string) {
    const cursor = query.cursor
      ? threadCursorSchema.parse(decodeCursor(query.cursor))
      : null;

    const rows = await prisma.supportThread.findMany({
      where: {
        ...(query.status ? { status: query.status as "OPEN" } : {}),
        ...(query.mine ? { assignedToId: staffId } : {}),
        ...(cursor
          ? {
              OR: [
                { lastMessageAt: { lt: new Date(cursor.lastMessageAt) } },
                {
                  lastMessageAt: new Date(cursor.lastMessageAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: {
        id: true,
        status: true,
        subject: true,
        expiresAt: true,
        lastMessageAt: true,
        user: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { messages: true } },
        messages: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: { body: true },
        },
      },
    });

    const items = rows.slice(0, query.limit);
    const next = rows.length > query.limit ? items.at(-1) : undefined;

    return {
      items: items.map((row) => ({
        id: row.id,
        status: row.status,
        subject: row.subject,
        visitorName: row.user?.name ?? "Guest",
        visitorEmail: row.user?.email ?? null,
        assignedToName: row.assignedTo?.name ?? null,
        messageCount: row._count.messages,
        lastMessagePreview: row.messages[0]?.body.slice(0, 140) ?? null,
        lastMessageAt: row.lastMessageAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
      })),
      nextCursor: next
        ? encodeCursor({
            lastMessageAt: next.lastMessageAt.toISOString(),
            id: next.id,
          })
        : null,
    };
  }

  async staffThread(threadId: string) {
    const row = await prisma.supportThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        status: true,
        subject: true,
        expiresAt: true,
        lastMessageAt: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 200,
          select: {
            id: true,
            authorRole: true,
            body: true,
            createdAt: true,
            author: { select: { name: true } },
            attachment: {
              select: {
                objectKey: true,
                variants: { select: { name: true, objectKey: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException();

    return {
      id: row.id,
      status: row.status,
      subject: row.subject,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      lastMessageAt: row.lastMessageAt.toISOString(),
      messages: row.messages.map((message) => ({
        id: message.id,
        authorRole: message.authorRole,
        authorName: message.author?.name ?? null,
        body: message.body,
        attachmentUrl: attachmentUrl(message.attachment),
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  /** A staff reply also slides the window, so a replied-to guest is not cut off. */
  async sendStaffMessage(threadId: string, body: string, staffId: string) {
    return prisma.$transaction(async (tx) => {
      const thread = await tx.supportThread.findUnique({
        where: { id: threadId },
        select: { id: true, userId: true, assignedToId: true, status: true },
      });
      if (!thread) throw new NotFoundException();

      const message = await tx.supportMessage.create({
        data: {
          threadId,
          authorRole: "STAFF",
          authorId: staffId,
          body,
        },
        select: { id: true, createdAt: true },
      });

      await tx.supportThread.update({
        where: { id: threadId },
        data: {
          lastMessageAt: message.createdAt,
          // Replying claims an unassigned thread, so two staff do not collide.
          ...(thread.assignedToId ? {} : { assignedToId: staffId }),
          ...(thread.status === "OPEN" ? { status: "ASSIGNED" } : {}),
          ...(thread.userId ? {} : { expiresAt: new Date(Date.now() + TTL_MS) }),
        },
      });

      return { id: message.id, createdAt: message.createdAt.toISOString() };
    });
  }

  async assign(threadId: string, assigneeId: string | null, actorId: string) {
    const thread = await prisma.supportThread.findUnique({
      where: { id: threadId },
      select: { id: true },
    });
    if (!thread) throw new NotFoundException();

    if (assigneeId) {
      const staff = await prisma.staffMembership.findFirst({
        where: { userId: assigneeId, status: "ACTIVE" },
        select: { userId: true },
      });
      if (!staff) {
        throw new ForbiddenException({
          code: "NOT_STAFF",
          message: "Support threads can only be assigned to active staff.",
        });
      }
    }

    await prisma.supportThread.update({
      where: { id: threadId },
      data: {
        assignedToId: assigneeId,
        status: assigneeId ? "ASSIGNED" : "OPEN",
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "SETTINGS_UPDATED",
        entityType: "SupportThread",
        entityId: threadId,
      },
    });

    return { id: threadId, assigneeId };
  }

  async close(threadId: string, actorId: string) {
    await prisma.supportThread.update({
      where: { id: threadId },
      data: { status: "CLOSED" },
    });
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "SETTINGS_UPDATED",
        entityType: "SupportThread",
        entityId: threadId,
      },
    });
    return { id: threadId, status: "CLOSED" as const };
  }

  /**
   * Erases expired anonymous threads outright. Messages cascade, so nothing is
   * left behind for staff or in the database once the window closes.
   */
  async purgeExpired(): Promise<number> {
    const result = await prisma.supportThread.deleteMany({
      where: { userId: null, expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
