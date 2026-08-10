import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUES } from "@real-estate/queue";
import { AccountLifecycleReconciler } from "./account-lifecycle.reconciler";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.MEDIA })],
  providers: [AccountLifecycleReconciler],
})
export class AccountsWorkerModule {}
