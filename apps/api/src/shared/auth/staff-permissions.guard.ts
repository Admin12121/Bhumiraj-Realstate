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
import { STAFF_PERMISSIONS_KEY } from './staff-permissions.decorator';

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
}
