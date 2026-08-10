import { IoAdapter } from "@nestjs/platform-socket.io";
import type { INestApplicationContext } from "@nestjs/common";
import { createAdapter } from "@socket.io/redis-adapter";
import { createRedis } from "@real-estate/redis";
import type Redis from "ioredis";
import type { Server, ServerOptions } from "socket.io";
import { apiEnv } from "../../bootstrap-env";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private publisher?: Redis;
  private subscriber?: Redis;

  constructor(app: INestApplicationContext) {
    super((app as INestApplicationContext & { getHttpServer(): object }).getHttpServer());
  }

  async connectToRedis(): Promise<void> {
    this.publisher = createRedis(apiEnv.REDIS_CRITICAL_URL, "critical");
    this.subscriber = this.publisher.duplicate();
    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    this.adapterConstructor = createAdapter(this.publisher, this.subscriber);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      path: "/socket.io",
      cors: { origin: apiEnv.APP_URL, credentials: true },
      maxHttpBufferSize: 64 * 1024,
      perMessageDeflate: false,
    }) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  override async close(server: Server): Promise<void> {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.allSettled([
      this.publisher?.quit(),
      this.subscriber?.quit(),
    ]);
  }
}
