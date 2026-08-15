import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import {
  adminUsersQuerySchema,
  banUserSchema,
  idSchema,
  setAccountTypeSchema,
} from "@real-estate/contracts";
import { StaffPermissions } from "../../shared/auth/staff-permissions.decorator";
import { StaffPermissionsGuard } from "../../shared/auth/staff-permissions.guard";
import { ZodValidationPipe } from "../../shared/http/zod-validation.pipe";
import { ADMIN_PERMISSIONS } from "./admin.permissions";
import { AdminUsersService } from "./admin-users.service";

@Controller("api/v1/admin/users")
@UseGuards(StaffPermissionsGuard)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  @StaffPermissions(ADMIN_PERMISSIONS.USERS_READ)
  list(
    @Query(new ZodValidationPipe(adminUsersQuerySchema))
    query: z.infer<typeof adminUsersQuerySchema>,
  ) {
    return this.service.list(query);
  }

  @Post(":id/account-type")
  @StaffPermissions(ADMIN_PERMISSIONS.USERS_TYPE_MANAGE)
  accountType(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(setAccountTypeSchema))
    body: z.infer<typeof setAccountTypeSchema>,
    @Session() session: UserSession,
  ) {
    return this.service.setAccountType(session.user.id, id, body.accountType);
  }

  @Post(":id/ban")
  @StaffPermissions(ADMIN_PERMISSIONS.USERS_STATUS_MANAGE)
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
  @StaffPermissions(ADMIN_PERMISSIONS.USERS_STATUS_MANAGE)
  unban(
    @Param("id", new ZodValidationPipe(idSchema)) id: string,
    @Session() session: UserSession,
  ) {
    return this.service.unban(session.user.id, id);
  }
}
