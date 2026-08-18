import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { z } from "zod";
import {
  agentAvailabilitySchema,
  assignListingSchema,
  idSchema,
  listingFeeSettingsSchema,
  paymentProofQuerySchema,
  respondToAssignmentSchema,
  reviewPaymentProofSchema,
  submitPaymentProofSchema,
} from "@real-estate/contracts";
import {
  StaffPermissions,
  StrongAuth,
} from "../../shared/auth/staff-permissions.decorator";
import { StaffPermissionsGuard } from "../../shared/auth/staff-permissions.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ADMIN_PERMISSIONS } from "../admin/admin.permissions";
import { ListingPaymentsService } from "./listing-payments.service";

/** Owner-facing: pay for a listing and see what the fee is. */
@Controller("api/v1/listing-payments")
export class ListingPaymentsController {
  constructor(private readonly service: ListingPaymentsService) {}

  @Get("fee")
  fee() {
    return this.service.feeSettings();
  }

  @Post("proofs")
  submit(
    @Body(new ZodValidationPipe(submitPaymentProofSchema))
    body: z.infer<typeof submitPaymentProofSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.submitProof(body, session.user.id);
  }
}

/** Agent-facing: the workspace header — caseload, availability, offer count. */
@Controller("api/v1/agent/me")
export class AgentWorkspaceController {
  constructor(private readonly service: ListingPaymentsService) {}

  @Get()
  summary(@Session() session: UserSession) {
    return this.service.agentSummary(session.user.id);
  }

  @Patch()
  setAvailability(
    @Body(new ZodValidationPipe(agentAvailabilitySchema))
    body: z.infer<typeof agentAvailabilitySchema>,
    @Session() session: UserSession,
  ) {
    return this.service.setAgentAvailability(
      session.user.id,
      body.availabilityStatus,
    );
  }
}

/** Agent-facing: respond to an offer for one of their listings. */
@Controller("api/v1/agent/assignments")
export class AgentAssignmentsController {
  constructor(private readonly service: ListingPaymentsService) {}

  @Get()
  list(
    @Query("status") status: string | undefined,
    @Session() session: UserSession,
  ) {
    return this.service.agentAssignments(session.user.id, status);
  }

  @Post(":id/respond")
  respond(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(respondToAssignmentSchema))
    body: z.infer<typeof respondToAssignmentSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.respond(id, body, session.user.id);
  }
}

/** Staff-facing: verify payments, configure the fee, assign agents. */
@Controller("api/v1/admin")
@UseGuards(StaffPermissionsGuard)
export class AdminListingPaymentsController {
  constructor(private readonly service: ListingPaymentsService) {}

  @Get("listing-fee")
  @StaffPermissions(ADMIN_PERMISSIONS.SETTINGS_READ)
  fee() {
    return this.service.feeSettings();
  }

  @Put("listing-fee")
  @StaffPermissions(ADMIN_PERMISSIONS.SETTINGS_MANAGE)
  @StrongAuth()
  updateFee(
    @Body(new ZodValidationPipe(listingFeeSettingsSchema))
    body: z.infer<typeof listingFeeSettingsSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.updateFeeSettings(body, session.user.id);
  }

  @Get("payment-proofs")
  @StaffPermissions(ADMIN_PERMISSIONS.PAYMENTS_READ)
  proofs(
    @Query(new ZodValidationPipe(paymentProofQuerySchema))
    query: z.infer<typeof paymentProofQuerySchema>,
  ) {
    return this.service.listProofs(query);
  }

  @Post("payment-proofs/:id/review")
  @StaffPermissions(ADMIN_PERMISSIONS.PAYMENTS_REVIEW)
  @StrongAuth()
  review(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(reviewPaymentProofSchema))
    body: z.infer<typeof reviewPaymentProofSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.reviewProof(id, body, session.user.id);
  }

  @Get("assignable-agents")
  @StaffPermissions(ADMIN_PERMISSIONS.ASSIGNMENTS_MANAGE)
  agents() {
    return this.service.assignableAgents();
  }

  @Post("listings/:id/assign")
  @StaffPermissions(ADMIN_PERMISSIONS.ASSIGNMENTS_MANAGE)
  @StrongAuth()
  assign(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(assignListingSchema))
    body: z.infer<typeof assignListingSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.assign(id, body, session.user.id);
  }
}
