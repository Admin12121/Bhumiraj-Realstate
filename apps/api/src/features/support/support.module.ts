import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../shared/auth/access-control.module";
import {
  AdminSupportController,
  SupportController,
} from "./support.controller";
import { SupportService } from "./support.service";

@Module({
  imports: [AccessControlModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
