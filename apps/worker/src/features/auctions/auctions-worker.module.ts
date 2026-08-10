import { Module } from "@nestjs/common";
import { AuctionsReconciler } from "./auctions.reconciler";
@Module({ providers: [AuctionsReconciler] })
export class AuctionsWorkerModule {}
