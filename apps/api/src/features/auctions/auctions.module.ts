import { Module } from "@nestjs/common";
import { AuctionsController } from "./auctions.controller";
import {
  AdminAuctionEnrolmentController,
  AuctionEnrolmentController,
} from "./auction-enrolment.controller";
import { AuctionsGateway } from "./auctions.gateway";
import { AuctionsService } from "./auctions.service";
import { AuctionEnrolmentService } from "./auction-enrolment.service";
import { RealtimeService } from "../../shared/realtime/realtime.service";

@Module({
  controllers: [
    AuctionsController,
    AuctionEnrolmentController,
    AdminAuctionEnrolmentController,
  ],
  providers: [
    AuctionsService,
    AuctionEnrolmentService,
    AuctionsGateway,
    RealtimeService,
  ],
})
export class AuctionsModule {}
