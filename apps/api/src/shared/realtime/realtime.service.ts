import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { createRedis } from "@real-estate/redis";
import { apiEnv } from "../../bootstrap-env";

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly subscriber = createRedis(apiEnv.REDIS_CRITICAL_URL, "critical");
  private readonly emitter = new EventEmitter();

  async onModuleInit(): Promise<void> {
    await this.subscriber.connect();
    await this.subscriber.subscribe("realtime:events");
    this.subscriber.on("message", (_channel, payload) => {
      try {
        this.emitter.emit("event", JSON.parse(payload));
      } catch (error) {
        this.logger.warn(
          `Rejected malformed realtime payload: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    });
  }

  onEvent(listener: (event: unknown) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  async onModuleDestroy(): Promise<void> {
    this.emitter.removeAllListeners();
    await this.subscriber.quit();
  }
}
