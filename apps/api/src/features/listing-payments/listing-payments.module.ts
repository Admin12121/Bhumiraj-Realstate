import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../shared/auth/access-control.module";
import {
  AdminListingPaymentsController,
  AgentAssignmentsController,
  AgentWorkspaceController,
  ListingPaymentsController,
} from "./listing-payments.controller";
import { ListingPaymentsService } from "./listing-payments.service";

@Module({
  imports: [AccessControlModule],
  controllers: [
    ListingPaymentsController,
    AgentAssignmentsController,
    AgentWorkspaceController,
    AdminListingPaymentsController,
  ],
  providers: [ListingPaymentsService],
})
export class ListingPaymentsModule {}
