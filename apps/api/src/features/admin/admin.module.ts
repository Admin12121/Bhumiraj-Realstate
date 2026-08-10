import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminListingsController } from "./admin-listings.controller";
import { AdminAuctionsController } from "./admin-auctions.controller";
import { RolesGuard } from "../../shared/auth/roles.guard";
import { AdminOperationsController } from "./admin-operations.controller";
@Module({ controllers: [AdminUsersController, AdminListingsController, AdminAuctionsController, AdminOperationsController], providers: [AdminUsersService, RolesGuard] })
export class AdminModule {}
