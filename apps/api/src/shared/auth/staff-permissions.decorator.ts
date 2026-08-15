import { SetMetadata } from '@nestjs/common';

export const STAFF_PERMISSIONS_KEY = 'required_staff_permissions';
export const STAFF_FRESH_SESSION_KEY = 'required_staff_fresh_session';

export const StaffPermissions = (...permissions: string[]) =>
  SetMetadata(STAFF_PERMISSIONS_KEY, permissions);

/**
 * Requires a recently established session on top of the permission check, so
 * an irreversible action cannot ride a month-old cookie.
 */
export const FreshStaffSession = () =>
  SetMetadata(STAFF_FRESH_SESSION_KEY, true);
