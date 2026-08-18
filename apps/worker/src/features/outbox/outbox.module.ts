import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUES } from "@real-estate/queue";
import { OutboxPublisher } from "./outbox.publisher";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  providers: [OutboxPublisher],
})
export class OutboxModule {}
