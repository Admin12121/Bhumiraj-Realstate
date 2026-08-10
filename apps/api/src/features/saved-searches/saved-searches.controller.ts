import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { createSavedSearchSchema, idSchema } from "@real-estate/contracts";
import type { z } from "zod";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { SavedSearchesService } from "./saved-searches.service";

type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

@Controller("api/v1/saved-searches")
export class SavedSearchesController {
  constructor(private readonly savedSearches: SavedSearchesService) {}

  @Get()
  list(@Session() session: UserSession) {
    return this.savedSearches.list(session.user.id);
  }

  @Post()
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createSavedSearchSchema))
    body: CreateSavedSearchInput,
  ) {
    return this.savedSearches.create(session.user.id, body);
  }

  @Patch(":id/toggle-alerts")
  toggle(@Session() session: UserSession, @Param("id", new ZodValidationPipe(idSchema)) id: string) {
    return this.savedSearches.toggle(session.user.id, id);
  }

  @Delete(":id")
  remove(@Session() session: UserSession, @Param("id", new ZodValidationPipe(idSchema)) id: string) {
    return this.savedSearches.remove(session.user.id, id);
  }
}
