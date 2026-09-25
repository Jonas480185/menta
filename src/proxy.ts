import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  isAuthPage,
  isProtectedPath,
  loginPath,
  PATHNAME_HEADER,
  safeNextPath,
} from "@/server/auth/redirects";

/**
 * Optimistic auth redirects based on the presence of the session cookie only (no DB).
 * NOT a security boundary – every protected page/action still calls requireUser() /
 * getServiceContext(), which validate the session against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = getSessionCookie(request) !== null;

  if (!hasSessionCookie && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
  }

  if (hasSessionCookie && isAuthPage(pathname)) {
    // "/" decides between /today and /onboarding (and clears stale cookies if needed).
    const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/";
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Let server components know the requested URL, so requireUser() can build `?next=`.
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip API routes, Next internals and any file with an extension (static assets).
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
