import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { prisma } from "@real-estate/database";
import { QUEUES } from "@real-estate/queue";
import { createRedis } from "@real-estate/redis";
import { workerEnv } from "../../bootstrap-env";

const OUTBOX_BATCH_SIZE = 100;
const PROCESSING_LEASE_MS = 5 * 60 * 1_000;
const MAX_ATTEMPTS = 20;

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly redis = createRedis(workerEnv.REDIS_CRITICAL_URL, "critical");
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly notifications: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.connect();
    this.timer = setInterval(() => void this.tick(), 500);
    this.timer.unref();
    await this.tick();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.redis.quit();
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const ids = await this.claimBatch();
      if (ids.length === 0) return;

      const events = await prisma.outboxEvent.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: "asc" },
      });

      for (const event of events) {
        try {
          const envelope = {
            ...(event.payload as object),
            eventId: event.id,
            eventType: event.eventType,
          };
          const payload = JSON.stringify(envelope);

          // Delivery is intentionally at-least-once. Consumers use eventId and
          // aggregate sequence values to ignore a replay after a worker crash.
          await this.redis.publish("realtime:events", payload);
          await this.redis.xadd(
            "realtime:event-stream",
            "MAXLEN",
            "~",
            "100000",
            "*",
            "eventId",
            event.id,
            "payload",
            payload,
          );
          // A notification is realtime *and* email. Enqueuing here rather than
          // at each call site means every producer gets delivery, retries and
          // the NotificationDelivery audit row for free.
          if (event.eventType === "notification.created") {
            const notificationId = (event.payload as { notificationId?: string })
              ?.notificationId;
            if (notificationId) {
              await this.notifications.add(
                "email",
                { notificationId, channel: "EMAIL" as const },
                {
                  // The outbox is at-least-once, so a replay must not resend.
                  jobId: `notification:${notificationId}:EMAIL`,
                  attempts: 5,
                  backoff: { type: "exponential", delay: 5_000 },
                  removeOnComplete: 1_000,
                  removeOnFail: 5_000,
                },
              );
            }
          }

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: "PUBLISHED",
              publishedAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          await this.handleFailure(event.id, event.attempts, error);
        }
      }
    } catch (error) {
      this.logger.error(error);
    } finally {
      this.running = false;
    }
  }

  private async claimBatch(): Promise<string[]> {
    const leaseUntil = new Date(Date.now() + PROCESSING_LEASE_MS);

    return prisma.$transaction(async (tx) => {
      // PROCESSING events whose lease expired are reclaimed. Without this,
      // terminating a worker after the claim would strand the event forever.
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "OutboxEvent"
        WHERE "availableAt" <= NOW()
          AND (
            (status = 'PENDING' AND attempts < ${MAX_ATTEMPTS}) OR
            (status = 'PROCESSING' AND attempts <= ${MAX_ATTEMPTS})
          )
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT ${OUTBOX_BATCH_SIZE}
      `;
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
          availableAt: leaseUntil,
        },
      });
      return ids;
    });
  }

  private async handleFailure(
    id: string,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const lastError =
      error instanceof Error ? error.message.slice(0, 2_000) : "Unknown error";

    if (attempts >= MAX_ATTEMPTS) {
      await prisma.outboxEvent.update({
        where: { id },
        data: { status: "FAILED", lastError },
      });
      this.logger.error(`Outbox event ${id} exhausted ${attempts} attempts.`);
      return;
    }

    const delaySeconds = Math.min(300, 2 ** Math.min(attempts, 8));
    await prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "PENDING",
        availableAt: new Date(Date.now() + delaySeconds * 1_000),
        lastError,
      },
    });
  }
}
