import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { prisma } from "@real-estate/database";
import { createRedis } from "@real-estate/redis";
import { apiEnv } from "../../bootstrap-env";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redis = createRedis(apiEnv.REDIS_CRITICAL_URL, "critical");

  async readiness() {
    const startedAt = Date.now();
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      this.pingRedis(),
    ]);

    const database = checks[0]?.status === "fulfilled";
    const redis = checks[1]?.status === "fulfilled";

    return {
      status: database && redis ? "ok" : "error",
      service: "real-estate-api",
      checks: { database, redis },
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }

  liveness() {
    return {
      status: "ok",
      service: "real-estate-api",
      uptimeSeconds: Math.round(globalThis.process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  private async pingRedis(): Promise<void> {
    if (this.redis.status === "wait") await this.redis.connect();
    const pong = await this.redis.ping();
    if (pong !== "PONG") throw new Error("Redis did not return PONG");
  }
}
