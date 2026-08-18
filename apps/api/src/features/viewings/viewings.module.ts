import { Module } from "@nestjs/common";
import {
  AgentViewingsController,
  ViewingsController,
} from "./viewings.controller";
import { ViewingsService } from "./viewings.service";

@Module({
  controllers: [ViewingsController, AgentViewingsController],
  providers: [ViewingsService],
})
export class ViewingsModule {}
