import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { QUEUES } from "@real-estate/queue";
import { prisma } from "@real-estate/database";
import { sendResendEmail } from "@real-estate/email";
import type { Job } from "bullmq";
import { workerEnv } from "../../bootstrap-env";

@Processor(QUEUES.NOTIFICATIONS, { concurrency: 10 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(
    job: Job<{ notificationId: string; channel: "EMAIL" | "IN_APP" }>,
  ): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      include: { user: { select: { email: true } } },
    });
    if (!notification || job.data.channel === "IN_APP") return;

    try {
      await sendResendEmail({
        apiKey: workerEnv.RESEND_API_KEY,
        from: workerEnv.MAIL_FROM,
        to: notification.user.email,
        subject: notification.title,
        text: notification.body,
      });
      await prisma.notificationDelivery.upsert({
        where: {
          notificationId_channel: {
            notificationId: notification.id,
            channel: "EMAIL",
          },
        },
        update: {
          status: "SENT",
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
          error: null,
        },
        create: {
          notificationId: notification.id,
          channel: "EMAIL",
          status: "SENT",
          lastAttemptAt: new Date(),
          attemptCount: 1,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Email delivery failed";
      this.logger.warn({ notificationId: notification.id, message });
      await prisma.notificationDelivery.upsert({
        where: {
          notificationId_channel: {
            notificationId: notification.id,
            channel: "EMAIL",
          },
        },
        update: {
          status: "FAILED",
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
          error: message.slice(0, 2_000),
        },
        create: {
          notificationId: notification.id,
          channel: "EMAIL",
          status: "FAILED",
          lastAttemptAt: new Date(),
          attemptCount: 1,
          error: message.slice(0, 2_000),
        },
      });
      throw error;
    }
  }
}
