import { Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { cursorQuerySchema, idSchema } from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { FavoritesService } from "./favorites.service";

@Controller("api/v1/favorites")
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(
    @Session() session: UserSession,
    @Query(new ZodValidationPipe(cursorQuerySchema))
    query: z.infer<typeof cursorQuerySchema>,
  ) {
    return this.favorites.list(session.user.id, query.cursor, query.limit);
  }

  @Post(":listingId")
  add(
    @Param("listingId", new ZodValidationPipe(idSchema)) listingId: string,
    @Session() session: UserSession,
  ) {
    return this.favorites.add(session.user.id, listingId);
  }

  @Delete(":listingId")
  remove(
    @Param("listingId", new ZodValidationPipe(idSchema)) listingId: string,
    @Session() session: UserSession,
  ) {
    return this.favorites.remove(session.user.id, listingId);
  }
}
