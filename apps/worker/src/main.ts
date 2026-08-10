import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { workerEnv } from "./bootstrap-env";
import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  // Referencing the parsed value makes the fail-fast configuration boundary
  // explicit and prevents production workers from silently using defaults.
  void workerEnv;
  const application = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["log", "warn", "error"],
  });

  const shutdown = async () => application.close();
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

void bootstrap().catch((error: unknown) => {
  console.error("Worker startup failed", error);
  process.exitCode = 1;
});
