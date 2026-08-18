import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUES } from "@real-estate/queue";
import { workerEnv } from "./bootstrap-env";
import { OutboxModule } from "./features/outbox/outbox.module";
import { AuctionsWorkerModule } from "./features/auctions/auctions-worker.module";
import { MediaWorkerModule } from "./features/media/media-worker.module";
import { NotificationsWorkerModule } from "./features/notifications/notifications-worker.module";
import { AccountsWorkerModule } from "./features/accounts/accounts-worker.module";
import { SupportWorkerModule } from "./features/support/support-worker.module";

@Module({
  imports: [
    BullModule.forRoot({ connection: { url: workerEnv.REDIS_CRITICAL_URL } }),
    BullModule.registerQueue(
      ...Object.values(QUEUES).map((name) => ({ name })),
    ),
    OutboxModule,
    AuctionsWorkerModule,
    MediaWorkerModule,
    NotificationsWorkerModule,
    AccountsWorkerModule,
    SupportWorkerModule,
  ],
})
export class WorkerModule {}
