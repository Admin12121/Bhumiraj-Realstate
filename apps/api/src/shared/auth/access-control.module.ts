import { Global, Module } from '@nestjs/common';
import { StaffAccessService } from './staff-access.service';
import { StaffPermissionsGuard } from './staff-permissions.guard';

@Global()
@Module({
  providers: [StaffAccessService, StaffPermissionsGuard],
  exports: [StaffAccessService, StaffPermissionsGuard],
})
export class AccessControlModule {}
