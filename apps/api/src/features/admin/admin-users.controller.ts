import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  adminUsersQuerySchema,
  banUserSchema,
  idSchema,
  setRoleSchema,
} from "@real-estate/contracts";
import { Roles } from "../../shared/auth/roles.decorator";
import { RolesGuard } from "../../shared/auth/roles.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { AdminUsersService } from "./admin-users.service";

@Controller("api/v1/admin/users")
@UseGuards(RolesGuard)
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminUsersQuerySchema))
    query: z.infer<typeof adminUsersQuerySchema>,
  ) {
    return this.service.list(query);
  }

  @Post(":id/role")
  role(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(setRoleSchema))
    body: z.infer<typeof setRoleSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.setRole(session.user.id, id, body.role);
  }

  @Post(":id/ban")
  ban(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(banUserSchema))
    body: z.infer<typeof banUserSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.ban(
      session.user.id,
      id,
      body.reason,
      body.expiresAt,
    );
  }

  @Post(":id/unban")
  unban(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.unban(session.user.id, id);
  }
}
