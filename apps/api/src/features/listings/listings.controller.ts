import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import { z } from "zod";
import {
  createListingSchema,
  idSchema,
  listingFeedQuerySchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ListingsService } from "./listings.service";

const listingSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

@Controller("api/v1/listings")
export class ListingsController {
  constructor(private readonly service: ListingsService) {}

  @Get()
  @OptionalAuth()
  feed(
    @Query(new ZodValidationPipe(listingFeedQuerySchema))
    query: z.infer<typeof listingFeedQuerySchema>,
    @Session() session?: UserSession,
  ) {
    return this.service.feed(query, session?.user.id);
  }

  @Get(":slug")
  @OptionalAuth()
  detail(
    @Param("slug", new ZodValidationPipe(listingSlugSchema)) slug: string,
    @Session() session?: UserSession,
  ) {
    return this.service.detail(slug, session?.user.id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createListingSchema))
    body: z.infer<typeof createListingSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.create(session.user.id, body);
  }

  @Post(":id/submit")
  submit(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.submit(id, session.user.id);
  }

  @Post(":id/view")
  @OptionalAuth()
  recordView(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession | undefined,
    @Req()
    request: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    return this.service.recordView(
      id,
      session?.user.id,
      request.ip,
      request.headers["user-agent"],
    );
  }
}
