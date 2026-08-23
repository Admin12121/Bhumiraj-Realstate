import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import {
  auctionDepositSettingsSchema,
  idSchema,
  reviewEnrolmentSchema,
  submitEnrolmentSchema,
} from "@real-estate/contracts";
import {
  StaffPermissions,
  StrongAuth,
} from "../../shared/auth/staff-permissions.decorator";
import { StaffPermissionsGuard } from "../../shared/auth/staff-permissions.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ADMIN_PERMISSIONS } from "../admin/admin.permissions";
import { AuctionEnrolmentService } from "./auction-enrolment.service";

/** Bidder-facing: see the deposit terms and submit a receipt. */
@Controller("api/v1/auctions")
export class AuctionEnrolmentController {
  constructor(private readonly service: AuctionEnrolmentService) {}

  @Get(":id/enrolment")
  view(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.view(id, session.user.id);
  }

  @Post(":id/enrolment")
  submit(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(submitEnrolmentSchema))
    body: z.infer<typeof submitEnrolmentSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.submit(id, session.user.id, body);
  }
}

const queueQuerySchema = z.object({
  status: z.enum(["PENDING", "ELIGIBLE", "REJECTED"]).default("PENDING"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/** Staff-facing: configure the deposit and decide who joins the bidder list. */
@Controller("api/v1/admin")
@UseGuards(StaffPermissionsGuard)
export class AdminAuctionEnrolmentController {
  constructor(private readonly service: AuctionEnrolmentService) {}

  @Get("auction-deposit")
  @StaffPermissions(ADMIN_PERMISSIONS.SETTINGS_READ)
  deposit() {
    return this.service.depositSettings();
  }

  @Put("auction-deposit")
  @StaffPermissions(ADMIN_PERMISSIONS.SETTINGS_MANAGE)
  @StrongAuth()
  updateDeposit(
    @Body(new ZodValidationPipe(auctionDepositSettingsSchema))
    body: z.infer<typeof auctionDepositSettingsSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.updateDepositSettings(body, session.user.id);
  }

  @Get("auction-enrolments")
  @StaffPermissions(ADMIN_PERMISSIONS.AUCTIONS_READ)
  queue(
    @Query(new ZodValidationPipe(queueQuerySchema))
    query: z.infer<typeof queueQuerySchema>,
  ) {
    return this.service.queue(query.status, query.limit);
  }

  @Post("auction-enrolments/:id/review")
  @StaffPermissions(ADMIN_PERMISSIONS.AUCTIONS_MANAGE)
  @StrongAuth()
  review(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(reviewEnrolmentSchema))
    body: z.infer<typeof reviewEnrolmentSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.review(id, session.user.id, body);
  }
}
