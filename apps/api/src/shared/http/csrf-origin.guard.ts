import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { apiEnv } from "../../bootstrap-env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Enforces same-origin browser writes for cookie-authenticated requests.
 *
 * Bearer-authenticated service clients without cookies remain supported. A
 * browser request carrying cookies must present a trustworthy Origin, Referer,
 * or same-origin Fetch Metadata signal. Better Auth also performs its own
 * origin checks for the routes mounted under `/api/auth/*`.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType<string>() !== "http") return true;

    const request = context.switchToHttp().getRequest<{
      method?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const method = (request.method ?? "GET").toUpperCase();
    if (SAFE_METHODS.has(method)) return true;

    const headers = request.headers ?? {};
    const trustedOrigin = normalizeOrigin(
      apiEnv.APP_URL,
    );
    const fetchSite = this.firstHeader(headers["sec-fetch-site"])?.toLowerCase();
    const hasCookies = Boolean(this.firstHeader(headers.cookie));

    if (fetchSite === "cross-site") throw this.forbidden();

    const originHeader = this.firstHeader(headers.origin);
    if (originHeader !== undefined) {
      this.assertTrustedOrigin(originHeader, trustedOrigin);
      return true;
    }

    const refererHeader = this.firstHeader(headers.referer);
    if (refererHeader !== undefined) {
      this.assertTrustedOrigin(refererHeader, trustedOrigin);
      return true;
    }

    // Modern same-origin fetches can be accepted from Fetch Metadata even
    // when an intermediary removes Origin. `same-site` is intentionally not
    // accepted because this deployment uses one public origin.
    if (fetchSite === "same-origin" || fetchSite === "none") return true;

    // A server-to-server client using an Authorization header and no browser
    // cookie is not vulnerable to cookie-based CSRF.
    if (!hasCookies) return true;

    throw this.forbidden();
  }

  private assertTrustedOrigin(
    candidate: string,
    trustedOrigin: string | null,
  ): void {
    const candidateOrigin = normalizeOrigin(candidate);
    if (
      !candidateOrigin ||
      !trustedOrigin ||
      candidateOrigin !== trustedOrigin
    ) {
      throw this.forbidden();
    }
  }

  private firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      code: "CROSS_SITE_REQUEST_REJECTED",
      message: "Cross-site state-changing requests are not allowed.",
    });
  }
}
