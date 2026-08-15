import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { z } from 'zod';
import {
  acceptPlatformInvitationSchema,
  createAgentInvitationSchema,
  createStaffInvitationSchema,
  idSchema,
  platformInvitationsQuerySchema,
  transferOwnershipSchema,
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
import { PlatformGovernanceService } from './platform-governance.service';

@Controller('api/v1/admin')
@UseGuards(StaffPermissionsGuard)
export class PlatformGovernanceAdminController {
  constructor(private readonly service: PlatformGovernanceService) {}

  @Get('staff-invitations')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_READ)
  listStaffInvitations(
    @Query(new ZodValidationPipe(platformInvitationsQuerySchema))
    query: z.infer<typeof platformInvitationsQuerySchema>,
  ) {
    return this.service.listInvitations(query, 'STAFF');
  }

  @Post('staff-invitations')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  createStaffInvitation(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Body(new ZodValidationPipe(createStaffInvitationSchema))
    body: z.infer<typeof createStaffInvitationSchema>,
  ) {
    return this.service.createInvitation(
      session.user.id,
      this.requireAccess(request),
      { email: body.email, roleIds: body.roleIds, type: 'STAFF' },
    );
  }

  @Delete('staff-invitations/:id')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @StrongAuth()
  revokeStaffInvitation(
    @Session() session: UserSession,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.service.revokeInvitation(session.user.id, id, 'STAFF');
  }

  @Get('agent-invitations')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_READ)
  listAgentInvitations(
    @Query(new ZodValidationPipe(platformInvitationsQuerySchema))
    query: z.infer<typeof platformInvitationsQuerySchema>,
  ) {
    return this.service.listInvitations(query, 'AGENT');
  }

  @Post('agent-invitations')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_MANAGE)
  @StrongAuth()
  createAgentInvitation(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Body(new ZodValidationPipe(createAgentInvitationSchema))
    body: z.infer<typeof createAgentInvitationSchema>,
  ) {
    return this.service.createInvitation(
      session.user.id,
      this.requireAccess(request),
      { email: body.email, type: 'AGENT', roleIds: [] },
    );
  }

  @Delete('agent-invitations/:id')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_MANAGE)
  @StrongAuth()
  revokeAgentInvitation(
    @Session() session: UserSession,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
  ) {
    return this.service.revokeInvitation(session.user.id, id, 'AGENT');
  }

  @Post('owner/transfer')
  @StaffPermissions(ADMIN_PERMISSIONS.STAFF_MANAGE)
  @FreshStaffSession()
  transferOwnership(
    @Session() session: UserSession,
    @Req() request: StaffAuthorizedRequest,
    @Body(new ZodValidationPipe(transferOwnershipSchema))
    body: z.infer<typeof transferOwnershipSchema>,
  ) {
    return this.service.transferOwnership(
      session.user.id,
      this.requireAccess(request),
      body,
    );
  }

  private requireAccess(request: StaffAuthorizedRequest) {
    if (!request.staffAccess) {
      throw new Error(
        'Staff access guard did not attach authorization context.',
      );
    }
    return request.staffAccess;
  }
}

@Controller('api/v1/invitations')
export class PlatformInvitationAcceptanceController {
  constructor(private readonly service: PlatformGovernanceService) {}

  @Post('accept')
  accept(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(acceptPlatformInvitationSchema))
    body: z.infer<typeof acceptPlatformInvitationSchema>,
  ) {
    return this.service.acceptInvitation(session.user.id, body.token);
  }
}
