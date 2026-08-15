import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { z } from 'zod';
import {
  createStaffMemberSchema,
  createStaffRoleSchema,
  idSchema,
  setStaffRolePermissionsSchema,
  setStaffMemberRolesSchema,
  setStaffMembershipStatusSchema,
  staffMembersQuerySchema,
  staffCandidatesQuerySchema,
  updateStaffRoleSchema,
} from '@real-estate/contracts';
import {
  FreshStaffSession,
  StaffPermissions,
  StrongAuth,
} from '../../shared/auth/staff-permissions.decorator';
import {
  StaffPermissionsGuard,
  type StaffAuthorizedRequest,
} from '../../shared/auth/staff-permissions.guard';
import { ZodValidationPipe } from '../../shared/http/zod-validation.pipe';
import { ADMIN_PERMISSIONS } from './admin.permissions';
import { StaffRbacService } from './staff-rbac.service';

@Controller('api/v1/admin')
@UseGuards(StaffPermissionsGuard)
export class StaffRbacController {
  constructor(private readonly service: StaffRbacService) {}

  @Get('access')
  access(@Req() request: StaffAuthorizedRequest) {
    const access = this.requireAccess(request);
    return {
      accountType: access.accountType,
      permissions: [...access.permissions].sort(),
      highestRolePosition: access.highestRolePosition,
    };
  }

  @Get('roles')
  @StaffPermissions(ADMIN_PERMISSIONS.ROLES_READ)
  roles(@Req() request: StaffAuthorizedRequest) {
    return this.service.catalog(this.requireAccess(request));
  }

  @Post('roles')
  @StaffPermissions(ADMIN_PERMISSIONS.ROLES_MANAGE)
  @StrongAuth()
  createRole(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Body(new ZodValidationPipe(createStaffRoleSchema))
    body: z.infer<typeof createStaffRoleSchema>,
  ) {
    return this.service.createRole(
      session.user.id,
      this.requireAccess(request),
      body,
    );
  }

  @Patch('roles/:id')
  @StaffPermissions(ADMIN_PERMISSIONS.ROLES_MANAGE)
  @StrongAuth()
  updateRole(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(updateStaffRoleSchema))
    body: z.infer<typeof updateStaffRoleSchema>,
  ) {
    return this.service.updateRole(
      session.user.id,
      this.requireAccess(request),
      id,
      body,
    );
  }

  @Put('roles/:id/permissions')
  @StaffPermissions(ADMIN_PERMISSIONS.ROLES_MANAGE)
  @FreshStaffSession()
  setRolePermissions(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(setStaffRolePermissionsSchema))
    body: z.infer<typeof setStaffRolePermissionsSchema>,
  ) {
    return this.service.setRolePermissions(
      session.user.id,
      this.requireAccess(request),
      id,
      body.permissionKeys,
    );
  }

  @Delete('roles/:id')
  @StaffPermissions(ADMIN_PERMISSIONS.ROLES_MANAGE)
  @StrongAuth()
  deleteRole(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.service.deleteRole(
      session.user.id,
      this.requireAccess(request),
      id,
    );
  }

  @Get('staff')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_READ)
  staff(
    @Req() request: StaffAuthorizedRequest,
    @Query(new ZodValidationPipe(staffMembersQuerySchema))
    query: z.infer<typeof staffMembersQuerySchema>,
  ) {
    return this.service.listStaff(query, this.requireAccess(request));
  }

  @Post('staff')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  createStaff(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Body(new ZodValidationPipe(createStaffMemberSchema))
    body: z.infer<typeof createStaffMemberSchema>,
  ) {
    return this.service.createStaffMember(
      session.user.id,
      this.requireAccess(request),
      body,
    );
  }

  @Get('staff-candidates')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  candidates(
    @Query(new ZodValidationPipe(staffCandidatesQuerySchema))
    query: z.infer<typeof staffCandidatesQuerySchema>,
  ) {
    return this.service.searchCandidates(query.search);
  }

  @Post('staff/:userId/roles/:roleId')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  assignRole(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
    @Param('roleId', new ZodValidationPipe(idSchema)) roleId: string,
  ) {
    return this.service.assignRole(
      session.user.id,
      this.requireAccess(request),
      userId,
      roleId,
    );
  }

  @Put('staff/:userId/roles')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  setRoles(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
    @Body(new ZodValidationPipe(setStaffMemberRolesSchema))
    body: z.infer<typeof setStaffMemberRolesSchema>,
  ) {
    return this.service.setStaffRoles(
      session.user.id,
      this.requireAccess(request),
      userId,
      body.roleIds,
    );
  }

  @Delete('staff/:userId/roles/:roleId')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  removeRole(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
    @Param('roleId', new ZodValidationPipe(idSchema)) roleId: string,
  ) {
    return this.service.removeRole(
      session.user.id,
      this.requireAccess(request),
      userId,
      roleId,
    );
  }

  @Delete('staff/:userId')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  revokeStaff(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
  ) {
    return this.service.revokeStaffMember(
      session.user.id,
      this.requireAccess(request),
      userId,
    );
  }

  @Patch('staff/:userId/status')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  setStaffStatus(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
    @Body(new ZodValidationPipe(setStaffMembershipStatusSchema))
    body: z.infer<typeof setStaffMembershipStatusSchema>,
  ) {
    return this.service.setStaffStatus(
      session.user.id,
      this.requireAccess(request),
      userId,
      body.status,
      body.reason,
    );
  }

  private requireAccess(request: StaffAuthorizedRequest) {
    if (!request.staffAccess)
      throw new Error(
        'Staff access guard did not attach authorization context.',
      );
    return request.staffAccess;
  }
}
