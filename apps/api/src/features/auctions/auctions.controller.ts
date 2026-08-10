import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import {
  cursorQuerySchema,
  idSchema,
  placeBidSchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { AuctionsService } from "./auctions.service";

const historyQuerySchema = cursorQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

@Controller("api/v1/auctions")
export class AuctionsController {
  constructor(private readonly service: AuctionsService) {}

  @Get("mine/bids")
  myBids(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(cursorQuerySchema))
    query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.service.myBids(session.user.id, query.cursor, query.limit);
  }

  @Get(":id")
  @OptionalAuth()
  snapshot(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session?: UserSession,
  ) {
    return this.service.snapshot(id, session?.user.id);
  }

  @Post(":id/register")
  register(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.register(id, session.user.id);
  }

  @Post(":id/bids")
  bid(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(placeBidSchema))
    body: z.infer<typeof placeBidSchema>,
    @Headers("idempotency-key") idempotencyKey: string,
    @Req() request: { requestId?: string },
  ) {
    return this.service.placeBid(
      id,
      session.user.id,
      body.amountMinor,
      idempotencyKey,
      request.requestId,
    );
  }

  @Get(":id/bids")
  @OptionalAuth()
  history(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Query(new ZodValidationPipe(historyQuerySchema))
    query: z.infer<typeof historyQuerySchema>,
    @Session() session?: UserSession,
  ) {
    return this.service.history(
      id,
      query.cursor,
      query.limit,
      session?.user.id,
    );
  }
}
