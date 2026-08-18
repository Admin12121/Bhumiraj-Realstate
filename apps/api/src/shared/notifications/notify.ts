import type { Prisma } from "@real-estate/database";

type Tx = Prisma.TransactionClient;

export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

/**
 * Records a notification and the outbox event that carries it out of the
 * transaction. The worker's outbox publisher pushes it to the realtime channel
 * and enqueues the email, so a caller only has to describe the message.
 *
 * Must be called with the same `tx` as the change it announces: an event that
 * escapes a rolled-back transaction announces something that never happened.
 */
export async function notify(tx: Tx, input: NotificationInput): Promise<void> {
  const notification = await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ...(input.data === undefined ? {} : { data: input.data }),
    },
    select: { id: true },
  });

  await tx.outboxEvent.create({
    data: {
      aggregateType: "Notification",
      aggregateId: notification.id,
      eventType: "notification.created",
      payload: { userId: input.userId, notificationId: notification.id },
    },
  });
}
