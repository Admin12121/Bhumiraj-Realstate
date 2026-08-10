import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { prisma } from "@real-estate/database";
import { ROLES_KEY } from "./roles.decorator";
import { apiEnv } from "../../bootstrap-env";

const ELEVATED_ROLES = new Set(["MODERATOR", "ADMIN", "SUPER_ADMIN"]);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<{
      session?: { user?: { id?: string }; session?: { id?: string } };
    }>();
    const userId = request.session?.user?.id;
    const sessionId = request.session?.session?.id;
    if (!userId) throw new UnauthorizedException();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        banned: true,
        lifecycleStatus: true,
        sessions: sessionId
          ? { where: { id: sessionId }, take: 1, select: { authMethod: true } }
          : false,
      },
    });

    if (!user || user.banned || user.lifecycleStatus !== "ACTIVE") {
      throw new ForbiddenException({
        code: "ACCOUNT_INACTIVE",
        message: "This account cannot access protected administration resources.",
      });
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "You do not have permission to perform this action.",
      });
    }

    if (ELEVATED_ROLES.has(user.role) && !apiEnv.E2E_MODE) {
      const authMethod = Array.isArray(user.sessions)
        ? user.sessions[0]?.authMethod
        : undefined;
      const strongAuthentication =
        authMethod === "credential+2fa" || authMethod === "passkey";
      if (!strongAuthentication) {
        throw new ForbiddenException({
          code: "ADMIN_STEP_UP_REQUIRED",
          message:
            "Administrator access requires a verified passkey or an email/password session completed with TOTP or a backup code.",
        });
      }
    }

    return true;
  }
}
