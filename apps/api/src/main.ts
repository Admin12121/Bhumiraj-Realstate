import { apiEnv } from "./bootstrap-env";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./shared/realtime/redis-io.adapter";
import { bootstrapStorage } from "./shared/storage/bootstrap-storage";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });

  const logger = app.get(Logger, { strict: false });
  if (logger) app.useLogger(logger);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  const express = app.getHttpAdapter().getInstance() as { set(name: string, value: unknown): void };
  express.set("trust proxy", apiEnv.TRUST_PROXY_HOPS);
  app.enableShutdownHooks();

  const adapter = new RedisIoAdapter(app);
  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);
  await bootstrapStorage();

  await app.listen(apiEnv.API_PORT, "0.0.0.0");
}

void bootstrap().catch((error: unknown) => {
  console.error("API startup failed", error);
  process.exitCode = 1;
});
