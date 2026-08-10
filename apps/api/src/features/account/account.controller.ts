import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  cancelDeletionSchema,
  idSchema,
  requestDeletionSchema
} from "@real-estate/contracts";
import type { z } from "zod";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { AccountService } from "./account.service";

@Controller("api/v1/account")
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get()
  overview(@Session() session: UserSession) {
    return this.service.overview(session.user.id);
  }

  @Get("sessions")
  sessions(@Session() session: UserSession) {
    return this.service.sessions(session.user.id, session.session.id);
  }

  @Delete("sessions/:id")
  revoke(@Session() session: UserSession, @Param("id", new ZodValidationPipe(idSchema)) id: string) {
    return this.service.revokeSession(session.user.id, id);
  }

  @Post("deletion")
  requestDeletion(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(requestDeletionSchema))
    body: z.infer<typeof requestDeletionSchema>,
  ) {
    return this.service.requestDeletion(
      session.user.id,
      session.session.id,
      body.confirmation,
    );
  }

  @Post("deletion/cancel")
  cancelDeletion(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(cancelDeletionSchema))
    body: z.infer<typeof cancelDeletionSchema>,
  ) {
    return this.service.cancelDeletion(session.user.id, body.confirmation);
  }
}
