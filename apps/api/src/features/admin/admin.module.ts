import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminListingsController } from './admin-listings.controller';
import { AdminAuctionsController } from './admin-auctions.controller';
import { AdminOperationsController } from './admin-operations.controller';
import { TicketsService } from './tickets.service';
import { StaffRbacController } from './staff-rbac.controller';
import { StaffRbacService } from './staff-rbac.service';
import {
  PlatformGovernanceAdminController,
  PlatformInvitationAcceptanceController,
} from './platform-governance.controller';
import { PlatformGovernanceService } from './platform-governance.service';
import { AgentGovernanceController } from './agent-governance.controller';
import { AgentGovernanceService } from './agent-governance.service';
import './admin.permissions';

@Module({
  controllers: [
    AdminUsersController,
    AdminListingsController,
    AdminAuctionsController,
    AdminOperationsController,
    StaffRbacController,
    PlatformGovernanceAdminController,
    PlatformInvitationAcceptanceController,
    AgentGovernanceController,
  ],
  providers: [
    AdminUsersService,
    StaffRbacService,
    PlatformGovernanceService,
    AgentGovernanceService,
    TicketsService,
  ],
})
export class AdminModule {}
