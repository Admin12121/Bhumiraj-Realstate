import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/account", "/post-property", "/admin"];

/**
 * Cheap pre-filter only. A cookie proves nothing about the session's validity —
 * the API re-derives authorization on every request — so this is used to send
 * anonymous visitors to sign-in, never to decide that someone is signed in.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(({ name }) => name.endsWith("bhumiraj.session_token"));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const protectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (protectedRoute && !hasSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("callbackURL", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  // Authentication pages are deliberately always reachable. Bouncing a visitor
  // away because a cookie exists strands anyone holding a stale or foreign
  // session: signed out everywhere, yet unable to open sign-in to fix it.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
