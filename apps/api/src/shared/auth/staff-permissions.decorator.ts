import { SetMetadata } from '@nestjs/common';

export const STAFF_PERMISSIONS_KEY = 'required_staff_permissions';

export const StaffPermissions = (...permissions: string[]) =>
  SetMetadata(STAFF_PERMISSIONS_KEY, permissions);
