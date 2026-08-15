import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/account", "/post-property", "/admin"];
const authPrefixes = ["/sign-in", "/sign-up", "/forgot-password", "/two-factor"];

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.endsWith("better-auth.session_token"));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = hasSessionCookie(request);
  const protectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (protectedRoute && !authenticated) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackURL", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (authenticated && authPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
