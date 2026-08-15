import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { z } from 'zod';
import {
  createAgentSchema,
  idSchema,
  setAgentAvailabilitySchema,
  setAgentStatusSchema,
  staffCandidatesQuerySchema,
} from '@real-estate/contracts';
import { StaffPermissions } from '../../shared/auth/staff-permissions.decorator';
import { StaffPermissionsGuard } from '../../shared/auth/staff-permissions.guard';
import { ZodValidationPipe } from '../../shared/http/zod-validation.pipe';
import { ADMIN_PERMISSIONS } from './admin.permissions';
import { AgentGovernanceService } from './agent-governance.service';

@Controller('api/v1/admin/agents')
@UseGuards(StaffPermissionsGuard)
export class AgentGovernanceController {
  constructor(private readonly service: AgentGovernanceService) {}

  @Get('candidates')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_MANAGE)
  candidates(
    @Query(new ZodValidationPipe(staffCandidatesQuerySchema))
    query: z.infer<typeof staffCandidatesQuerySchema>,
  ) {
    return this.service.searchCandidates(query.search);
  }

  @Post()
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_MANAGE)
  create(
    @Session() session: UserSession,
    @Body(new ZodValidationPipe(createAgentSchema))
    body: z.infer<typeof createAgentSchema>,
  ) {
    return this.service.createAgent(session.user.id, body.userId);
  }

  @Patch(':id/status')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_MANAGE)
  setStatus(
    @Session() session: UserSession,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(setAgentStatusSchema))
    body: z.infer<typeof setAgentStatusSchema>,
  ) {
    return this.service.setStatus(
      session.user.id,
      id,
      body.status,
      body.reason,
    );
  }

  @Patch(':id/availability')
  @StaffPermissions(ADMIN_PERMISSIONS.AGENTS_MANAGE)
  setAvailability(
    @Session() session: UserSession,
    @Param('id', new ZodValidationPipe(idSchema)) id: string,
    @Body(new ZodValidationPipe(setAgentAvailabilitySchema))
    body: z.infer<typeof setAgentAvailabilitySchema>,
  ) {
    return this.service.setAvailability(
      session.user.id,
      id,
      body.availabilityStatus,
      body.maxActiveCases,
    );
  }
}
