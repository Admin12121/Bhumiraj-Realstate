import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  idSchema,
  notificationQuerySchema,
} from "@real-estate/contracts";
import { prisma } from "@real-estate/database";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { decodeCursor, encodeCursor } from "../../shared/utils/cursor";

const notificationCursorSchema = z
  .object({ createdAt: z.iso.datetime({ offset: true }), id: idSchema })
  .strict();

@Controller("api/v1/notifications")
export class NotificationsController {
  @Get()
  async list(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(notificationQuerySchema))
    query: z.infer<typeof notificationQuerySchema>,
  ) {
    const decoded = decodeCursor(query.cursor, notificationCursorSchema);
    const cursorDate = decoded ? new Date(decoded.createdAt) : undefined;
    const rows = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(query.unreadOnly ? { readAt: null } : {}),
        ...(decoded && cursorDate
          ? {
              OR: [
                { createdAt: { lt: cursorDate } },
                { createdAt: cursorDate, id: { lt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    });
    const hasMore = rows.length > query.limit;
    const visible = rows.slice(0, query.limit);
    const items = visible.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString() ?? null,
    }));
    const last = visible.at(-1);
    return {
      items,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  @Patch(":id/read")
  async read(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
  ) {
    await prisma.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { readAt: new Date() },
    });
    return { read: true };
  }

  @Patch("read-all")
  async readAll(@Session() session: UserSession) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true };
  }
}
