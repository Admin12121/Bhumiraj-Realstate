import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createViewingSchema,
  cursorQuerySchema,
  idSchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ViewingsService } from "./viewings.service";

@Controller("api/v1/viewings")
export class ViewingsController {
  constructor(private readonly viewings: ViewingsService) {}

  @Post("listing/:listingId")
  create(
    @Session() session: UserSession,
    @Param("listingId", new ZodValidationPipe(idSchema)) listingId: string,
    @Body(new ZodValidationPipe(createViewingSchema))
    body: z.infer<typeof createViewingSchema>,
  ) {
    return this.viewings.create(session.user.id, listingId, {
      scheduledAt: body.scheduledAt,
      ...(body.notes === undefined ? {} : { notes: body.notes }),
    });
  }

  @Get("mine")
  mine(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(cursorQuerySchema))
    query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.viewings.mine(session.user.id, query.cursor, query.limit);
  }
}
