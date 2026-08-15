import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiEnv } from '../../bootstrap-env';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from './staff-access.service';
import {
  STAFF_FRESH_SESSION_KEY,
  STAFF_PERMISSIONS_KEY,
} from './staff-permissions.decorator';

// Matches the Better Auth `freshAge` window configured for the platform.
const FRESH_SESSION_MAX_AGE_MS = 30 * 60 * 1_000;

export type StaffAuthorizedRequest = {
  session?: { user?: { id?: string }; session?: { id?: string } };
  staffAccess?: StaffAccessSnapshot;
};

@Injectable()
export class StaffPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: StaffAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(STAFF_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiresFreshSession =
      this.reflector.getAllAndOverride<boolean>(STAFF_FRESH_SESSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    const request = context.switchToHttp().getRequest<StaffAuthorizedRequest>();
    const userId = request.session?.user?.id;
    if (!userId) throw new UnauthorizedException();

    const access = await this.accessService.resolve(
      userId,
      request.session?.session?.id,
    );
    if (!access) {
      throw new ForbiddenException({
        code: 'STAFF_ACCESS_REQUIRED',
        message: 'An active staff or owner account is required.',
      });
    }

    if (!apiEnv.E2E_MODE) {
      const strongAuthentication =
        access.authMethod === 'credential+2fa' ||
        access.authMethod === 'passkey';
      if (!strongAuthentication) {
        throw new ForbiddenException({
          code: 'STAFF_STEP_UP_REQUIRED',
          message:
            'Staff access requires a passkey or a password session completed with two-factor authentication.',
        });
      }

      if (requiresFreshSession && !this.isFreshSession(access)) {
        throw new ForbiddenException({
          code: 'STAFF_FRESH_SESSION_REQUIRED',
          message:
            'Sign in again to confirm this action. It requires a session established within the last 30 minutes.',
        });
      }
    }

    const missing = required.filter(
      (permission) => !this.accessService.hasPermission(access, permission),
    );
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'STAFF_PERMISSION_REQUIRED',
        message: 'You do not have permission to perform this action.',
        missing,
      });
    }

    request.staffAccess = access;
    return true;
  }

  private isFreshSession(access: StaffAccessSnapshot): boolean {
    if (!access.sessionCreatedAt) return false;
    return (
      Date.now() - access.sessionCreatedAt.getTime() < FRESH_SESSION_MAX_AGE_MS
    );
  }
}
