import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { idSchema } from "@real-estate/contracts";
import { prisma } from "@real-estate/database";
import { auth } from "../../auth";
import { RealtimeService } from "../../shared/realtime/realtime.service";
import { apiEnv } from "../../bootstrap-env";

const auctionRoomSchema = z.object({ auctionId: idSchema });
const MAX_AUCTION_ROOMS_PER_SOCKET = 25;

function normalizedOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

@WebSocketGateway({
  namespace: "/realtime",
  path: "/socket.io",
  cors: { origin: apiEnv.APP_URL, credentials: true },
})
export class AuctionsGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private unsubscribe?: () => void;

  constructor(private readonly realtime: RealtimeService) {}

  onModuleInit(): void {
    this.unsubscribe = this.realtime.onEvent((event: unknown) => {
      if (!event || typeof event !== "object") return;
      const payload = event as Record<string, unknown>;

      if (typeof payload.auctionId === "string") {
        this.server
          .to(`auction:${payload.auctionId}`)
          .emit("auction:event", payload);
      }
      if (typeof payload.userId === "string") {
        this.server
          .to(`user:${payload.userId}`)
          .emit("notification:event", payload);
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  async handleConnection(client: Socket): Promise<void> {
    const socketData = client.data as Record<string, unknown>;
    const trustedOrigin = normalizedOrigin(apiEnv.APP_URL);
    const requestOrigin = normalizedOrigin(client.handshake.headers.origin);
    const hasCookie = Boolean(client.handshake.headers.cookie);

    if (
      !trustedOrigin ||
      (requestOrigin !== trustedOrigin && (requestOrigin !== null || hasCookie))
    ) {
      client.disconnect(true);
      return;
    }

    try {
      const headers = new Headers();
      if (client.handshake.headers.cookie) {
        headers.set("cookie", client.handshake.headers.cookie);
      }
      const session = await auth.api.getSession({ headers });
      if (session?.user?.id) {
        socketData.user = session.user;
        await client.join(`user:${session.user.id}`);
      }
    } catch {
      // A public auction connection may remain anonymous. Authentication
      // failures must never expose internal details over the socket handshake.
      socketData.user = undefined;
    }
  }

  @SubscribeMessage("auction:join")
  async join(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; code?: string }> {
    const parsed = auctionRoomSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, code: "INVALID_AUCTION_ID" };

    const joinedAuctionRooms = [...client.rooms].filter((room) =>
      room.startsWith("auction:"),
    ).length;
    if (joinedAuctionRooms >= MAX_AUCTION_ROOMS_PER_SOCKET) {
      return { ok: false, code: "ROOM_LIMIT_REACHED" };
    }

    const exists = await prisma.auction.count({
      where: {
        id: parsed.data.auctionId,
        listing: { status: "PUBLISHED" },
      },
    });
    if (!exists) return { ok: false, code: "AUCTION_NOT_AVAILABLE" };

    await client.join(`auction:${parsed.data.auctionId}`);
    return { ok: true };
  }

  @SubscribeMessage("auction:leave")
  async leave(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: unknown,
  ): Promise<{ ok: boolean; code?: string }> {
    const parsed = auctionRoomSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, code: "INVALID_AUCTION_ID" };

    await client.leave(`auction:${parsed.data.auctionId}`);
    return { ok: true };
  }
}
