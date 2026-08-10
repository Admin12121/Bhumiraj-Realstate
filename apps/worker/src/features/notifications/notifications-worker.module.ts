import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUES } from "@real-estate/queue";
import { NotificationProcessor } from "./notification.processor";
@Module({ imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })], providers: [NotificationProcessor] })
export class NotificationsWorkerModule {}
