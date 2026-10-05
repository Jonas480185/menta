import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
  isAuthPage,
  isProtectedPath,
  loginPath,
  PATHNAME_HEADER,
  safeNextPath,
} from "@/server/auth/redirects";
import { buildCsp, createNonce, NONCE_HEADER } from "@/server/security/csp";

/**
 * Optimistic auth redirects based on the presence of the session cookie only (no DB).
 * NOT a security boundary: every protected page/action still calls requireUser() /
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

  // Per-request CSP nonce: Next.js reads the CSP from the request headers and stamps its scripts.
  const nonce = createNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development" });
  headers.set(NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip API routes, Next internals and any file with an extension (static assets).
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
