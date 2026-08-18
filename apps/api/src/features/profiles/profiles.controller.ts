import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";
import {
  publicAgentsQuerySchema,
  updateProfileSchema,
  userIdSchema,
} from "@real-estate/contracts";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ProfilesService } from "./profiles.service";

@Controller("api/v1/profiles")
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}


  @Get("agents")
  @OptionalAuth()
  agents(
    @Query(new ZodValidationPipe(publicAgentsQuerySchema))
    query: z.infer<typeof publicAgentsQuerySchema>,
    @Session() session?: UserSession,
  ) {
    return this.service.listAgents(query, session?.user.id);
  }

  @Get("agents/:userId")
  @OptionalAuth()
  agentProfile(
    @Param("userId", new ZodValidationPipe(userIdSchema)) userId: string,
    @Session() session?: UserSession,
  ) {
    return this.service.agentProfile(userId, session?.user.id);
  }

  @Get("me")
  me(@Session() session: UserSession) {
    return this.service.get(session.user.id, session.user.id, true);
  }

  @Patch("me")
  update(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(updateProfileSchema))
    body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.service.update(session.user.id, body);
  }

  @Post(":id/follow")
  follow(
    @Param("id", new ZodValidationPipe(userIdSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.follow(id, session.user.id);
  }

  @Delete(":id/follow")
  unfollow(
    @Param("id", new ZodValidationPipe(userIdSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.unfollow(id, session.user.id);
  }

  @Get(":id")
  @OptionalAuth()
  publicProfile(
    @Param("id", new ZodValidationPipe(userIdSchema)) id: string,
    @Session() session?: UserSession,
  ) {
    return this.service.get(id, session?.user.id, false);
  }
}
