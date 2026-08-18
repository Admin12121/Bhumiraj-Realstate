import { Module } from "@nestjs/common";
import { SupportRetentionReconciler } from "./support-retention.reconciler";

@Module({ providers: [SupportRetentionReconciler] })
export class SupportWorkerModule {}
