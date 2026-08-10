import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  createInquirySchema,
  cursorQuerySchema,
  idSchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { InquiriesService } from "./inquiries.service";

@Controller("api/v1/inquiries")
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post("listing/:listingId")
  create(
    @Session() session: UserSession,
    @Param("listingId", new ZodValidationPipe(idSchema)) listingId: string,
    @Body(new ZodValidationPipe(createInquirySchema))
    body: z.infer<typeof createInquirySchema>,
  ) {
    return this.inquiries.create(session.user.id, listingId, body.message);
  }

  @Get("mine")
  mine(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(cursorQuerySchema))
    query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.inquiries.mine(session.user.id, query.cursor, query.limit);
  }
}
