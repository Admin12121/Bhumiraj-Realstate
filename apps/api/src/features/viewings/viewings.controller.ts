import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import {
  cursorQuerySchema,
  idSchema,
  requestViewingSchema,
  respondToViewingSchema,
  setAvailabilitySchema,
  viewingSlotQuerySchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ViewingsService } from "./viewings.service";

@Controller("api/v1/viewings")
export class ViewingsController {
  constructor(private readonly viewings: ViewingsService) {}

  /** Public: a buyer sees the times before deciding whether to sign in. */
  @Get("listings/:slug/slots")
  @OptionalAuth()
  slots(
    @Param("slug") slug: string,
    @Query(new ZodValidationPipe(viewingSlotQuerySchema))
    query: z.infer<typeof viewingSlotQuerySchema>,
  ) {
    return this.viewings.slots(slug, query.days);
  }

  @Post("listings/:slug")
  request(
    @Session() session: UserSession,
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(requestViewingSchema))
    body: z.infer<typeof requestViewingSchema>,
  ) {
    return this.viewings.request(session.user.id, slug, {
      startsAt: body.startsAt,
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

/** Agent-facing: their calendar and the hours they are willing to show in. */
@Controller("api/v1/agent/viewings")
export class AgentViewingsController {
  constructor(private readonly viewings: ViewingsService) {}

  @Get()
  list(
    @Session() session: UserSession,
    @Query("status") status: string | undefined,
  ) {
    return this.viewings.forAgent(session.user.id, status);
  }

  @Post(":id/respond")
  respond(
    @Session() session: UserSession,
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(respondToViewingSchema))
    body: z.infer<typeof respondToViewingSchema>,
  ) {
    return this.viewings.respond(id, session.user.id, {
      decision: body.decision,
      ...(body.note === undefined ? {} : { note: body.note }),
    });
  }

  @Get("availability")
  availability(@Session() session: UserSession) {
    return this.viewings.availability(session.user.id);
  }

  @Put("availability")
  setAvailability(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(setAvailabilitySchema))
    body: z.infer<typeof setAvailabilitySchema>,
  ) {
    return this.viewings.setAvailability(session.user.id, body.windows);
  }
}
