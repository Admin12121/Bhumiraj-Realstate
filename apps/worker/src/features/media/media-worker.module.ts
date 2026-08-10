import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUES } from "@real-estate/queue";
import { MediaProcessor } from "./media.processor";
@Module({ imports: [BullModule.registerQueue({ name: QUEUES.MEDIA })], providers: [MediaProcessor] })
export class MediaWorkerModule {}
