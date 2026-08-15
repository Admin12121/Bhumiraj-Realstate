import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isStrongAuthMethod } from '@real-estate/auth/method';
import { apiEnv } from '../../bootstrap-env';
import {
  StaffAccessService,
  type StaffAccessSnapshot,
} from './staff-access.service';
import {
  STAFF_FRESH_SESSION_KEY,
  STAFF_PERMISSIONS_KEY,
  STAFF_STRONG_AUTH_KEY,
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
    const targets = [context.getHandler(), context.getClass()];
    const required =
      this.reflector.getAllAndOverride<string[]>(
        STAFF_PERMISSIONS_KEY,
        targets,
      ) ?? [];
    const freshSessionRequired =
      this.reflector.getAllAndOverride<boolean>(
        STAFF_FRESH_SESSION_KEY,
        targets,
      ) ?? false;
    // A fresh-session route is by definition also a strong-auth route.
    const strongAuthRequired =
      freshSessionRequired ||
      (this.reflector.getAllAndOverride<boolean>(
        STAFF_STRONG_AUTH_KEY,
        targets,
      ) ??
        false);

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

    // Entry to administration needs only an active staff session. Step-up is
    // demanded per action so routine work is not gated behind enrolment.
    if (strongAuthRequired && !apiEnv.E2E_MODE) {
      if (!isStrongAuthMethod(access.authMethod)) {
        throw new ForbiddenException({
          code: 'STAFF_STEP_UP_REQUIRED',
          message:
            'Confirm your identity to continue. This action needs a passkey or a two-factor code.',
        });
      }
      if (freshSessionRequired && !this.isFreshSession(access)) {
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
