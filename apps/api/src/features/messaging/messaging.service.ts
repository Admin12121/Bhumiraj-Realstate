import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import {
  createConversationSchema,
  cursorSocialQuerySchema,
  idSchema,
  sendMessageSchema,
} from "@real-estate/contracts";
import { prisma } from "@real-estate/database";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";
import { assertActiveAccount } from "../../shared/auth/account-policy";

const messageCursorSchema = z
  .object({ createdAt: z.iso.datetime({ offset: true }), id: idSchema })
  .strict();
const conversationCursorSchema = z
  .object({ updatedAt: z.iso.datetime({ offset: true }), id: idSchema })
  .strict();

type MessageTransaction = {
  notification: Pick<typeof prisma.notification, "createMany">;
  outboxEvent: Pick<typeof prisma.outboxEvent, "createMany">;
};

@Injectable()
export class MessagingService {
  async conversations(
    userId: string,
    query: z.infer<typeof cursorSocialQuerySchema>,
  ) {
    const decoded = decodeCursor(query.cursor, conversationCursorSchema);
    const cursor = decoded
      ? { ...decoded, updatedAt: new Date(decoded.updatedAt) }
      : undefined;
    const rows = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId, archivedAt: null } },
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: {
        id: true,
        type: true,
        listingId: true,
        updatedAt: true,
        participants: {
          where: { userId: { not: userId } },
          select: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { body: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
    });

    const conversationIds = rows.map((row) => row.id);
    const memberships = conversationIds.length
      ? await prisma.conversationParticipant.findMany({
          where: { userId, conversationId: { in: conversationIds } },
          select: { conversationId: true, unreadCount: true },
        })
      : [];
    const unreadByConversation = new Map(
      memberships.map((membership) => [
        membership.conversationId,
        membership.unreadCount,
      ]),
    );

    const hasMore = rows.length > query.limit;
    const visible = rows.slice(0, query.limit);
    const items = visible.map((row) => ({
      id: row.id,
      type: row.type,
      listingId: row.listingId,
      updatedAt: row.updatedAt.toISOString(),
      unreadCount: unreadByConversation.get(row.id) ?? 0,
      participants: row.participants.map(({ user }) => user),
      lastMessage: row.messages[0]
        ? {
            body: row.messages[0].body,
            createdAt: row.messages[0].createdAt.toISOString(),
          }
        : null,
    }));
    const last = visible.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              updatedAt: last.updatedAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async createConversation(
    userId: string,
    input: z.infer<typeof createConversationSchema>,
  ) {
    await assertActiveAccount(userId, { requireVerifiedEmail: true });
    if (input.participantId === userId) {
      throw new BadRequestException({
        code: "SELF_CONVERSATION",
        message: "You cannot start a conversation with yourself.",
      });
    }

    const target = await prisma.user.findFirst({
      where: {
        id: input.participantId,
        banned: false,
        lifecycleStatus: "ACTIVE",
      },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();

    if (input.listingId) {
      const listing = await prisma.listing.findFirst({
        where: { id: input.listingId, status: "PUBLISHED" },
        select: {
          id: true,
          createdById: true,
          assignments: {
            where: { status: "ACCEPTED" },
            select: { agent: { select: { userId: true } } },
          },
        },
      });
      if (!listing) throw new NotFoundException();
      // The appointed agent is who a buyer is shown and told to contact, so
      // they count alongside the owner as a valid party on the listing.
      const allowed = new Set([
        listing.createdById,
        ...listing.assignments.map((row) => row.agent.userId),
      ]);
      if (!allowed.has(input.participantId)) {
        throw new BadRequestException({
          code: "INVALID_LISTING_PARTICIPANT",
          message: "That person is not connected to this listing.",
        });
      }
    }

    const participantIds = [userId, input.participantId].sort();
    const conversationKey = `${input.listingId ? "LISTING" : "DIRECT"}:${input.listingId ?? "-"}:${participantIds.join(":")}`;

    return prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.upsert({
        where: { conversationKey },
        update: {
          updatedAt: new Date(),
          participants: {
            updateMany: {
              where: { userId: { in: participantIds } },
              data: { archivedAt: null },
            },
          },
        },
        create: {
          conversationKey,
          type: input.listingId ? "LISTING" : "DIRECT",
          ...(input.listingId === undefined ? {} : { listingId: input.listingId }),
          participants: {
            create: [
              { userId, unreadCount: 0, lastReadAt: new Date() },
              { userId: input.participantId, unreadCount: 0 },
            ],
          },
        },
        select: { id: true },
      });

      await tx.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: input.participantId,
          },
        },
        data: { unreadCount: { increment: 1 }, archivedAt: null },
      });

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          body: input.message,
        },
        select: { id: true, createdAt: true },
      });
      await this.createMessageDeliveryRecords(tx, {
        conversationId: conversation.id,
        messageId: message.id,
        recipientIds: [input.participantId],
        body: input.message,
      });

      return { id: conversation.id };
    });
  }

  async messages(
    userId: string,
    conversationId: string,
    query: z.infer<typeof cursorSocialQuerySchema>,
  ) {
    await this.requireMembership(userId, conversationId);
    const decoded = decodeCursor(query.cursor, messageCursorSchema);
    const cursor = decoded
      ? { ...decoded, createdAt: new Date(decoded.createdAt) }
      : undefined;
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        body: true,
        createdAt: true,
        attachments: {
          select: {
            mediaAsset: {
              select: {
                id: true,
                originalFileName: true,
                contentType: true,
                sizeBytes: true,
              },
            },
          },
        },
      },
    });
    const hasMore = rows.length > query.limit;
    const visible = rows.slice(0, query.limit);
    const items = visible.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      senderId: row.senderId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      mine: row.senderId === userId,
      attachments: row.attachments.map(({ mediaAsset }) => ({
        assetId: mediaAsset.id,
        fileName: mediaAsset.originalFileName,
        contentType: mediaAsset.contentType,
        sizeBytes: mediaAsset.sizeBytes.toString(),
      })),
    }));
    const last = visible.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async send(
    userId: string,
    conversationId: string,
    input: z.infer<typeof sendMessageSchema>,
  ) {
    await assertActiveAccount(userId, { requireVerifiedEmail: true });
    const uniqueAssetIds = [...new Set(input.mediaAssetIds)];
    if (uniqueAssetIds.length !== input.mediaAssetIds.length) {
      throw new BadRequestException({
        code: "DUPLICATE_ATTACHMENT",
        message: "An attachment can only be added once.",
      });
    }

    return prisma.$transaction(async (tx) => {
      const membership = await tx.conversationParticipant.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        select: { conversationId: true },
      });
      if (!membership) throw new ForbiddenException();

      if (uniqueAssetIds.length) {
        const readyAssets = await tx.mediaAsset.count({
          where: {
            id: { in: uniqueAssetIds },
            ownerId: userId,
            status: "READY",
            purpose: "MESSAGE_ATTACHMENT",
          },
        });
        if (readyAssets !== uniqueAssetIds.length) {
          throw new BadRequestException({
            code: "ATTACHMENT_NOT_READY",
            message: "One or more message attachments are unavailable.",
          });
        }
      }

      const message = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: input.body,
          attachments: {
            create: uniqueAssetIds.map((mediaAssetId) => ({ mediaAssetId })),
          },
        },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          body: true,
          createdAt: true,
          attachments: {
            select: {
              mediaAsset: {
                select: {
                  id: true,
                  originalFileName: true,
                  contentType: true,
                  sizeBytes: true,
                },
              },
            },
          },
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: message.createdAt },
      });

      const recipients = await tx.conversationParticipant.findMany({
        where: { conversationId, userId: { not: userId } },
        select: { userId: true },
      });
      const recipientIds = recipients.map(({ userId: recipientId }) => recipientId);
      if (recipientIds.length) {
        await tx.conversationParticipant.updateMany({
          where: { conversationId, userId: { in: recipientIds } },
          data: { unreadCount: { increment: 1 }, archivedAt: null },
        });
      }
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: message.createdAt, unreadCount: 0 },
      });
      await this.createMessageDeliveryRecords(tx, {
        conversationId,
        messageId: message.id,
        recipientIds,
        body: input.body,
      });

      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        mine: true,
        attachments: message.attachments.map(({ mediaAsset }) => ({
          assetId: mediaAsset.id,
          fileName: mediaAsset.originalFileName,
          contentType: mediaAsset.contentType,
          sizeBytes: mediaAsset.sizeBytes.toString(),
        })),
      };
    });
  }

  async markRead(userId: string, conversationId: string) {
    const result = await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { unreadCount: 0, lastReadAt: new Date() },
    });
    if (!result.count) throw new NotFoundException();
    return { read: true };
  }

  private async requireMembership(userId: string, conversationId: string) {
    const membership = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    if (!membership) throw new NotFoundException();
  }

  private async createMessageDeliveryRecords(
    tx: MessageTransaction,
    input: {
      conversationId: string;
      messageId: string;
      recipientIds: string[];
      body: string;
    },
  ) {
    if (!input.recipientIds.length) return;
    await tx.notification.createMany({
      data: input.recipientIds.map((userId) => ({
        userId,
        type: "message.created",
        title: "New message",
        body: input.body.slice(0, 120),
        data: {
          conversationId: input.conversationId,
          messageId: input.messageId,
        },
      })),
    });
    await tx.outboxEvent.createMany({
      data: input.recipientIds.map((userId) => ({
        aggregateType: "Conversation",
        aggregateId: input.conversationId,
        eventType: "message.created",
        payload: {
          type: "message.created",
          userId,
          conversationId: input.conversationId,
          messageId: input.messageId,
        },
      })),
    });
  }

}
