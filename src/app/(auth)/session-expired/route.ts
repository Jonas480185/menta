import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/server/auth/server";
import { clearAuthCookies } from "@/server/auth/cookies";
import { LOGIN_PATH, safeNextPath } from "@/server/auth/redirects";

/**
 * Reached when a request carries a session cookie that no longer maps to a valid session
 * (expired, revoked, account deleted). Clears the stale cookies so proxy.ts stops treating
 * the visitor as signed in, then continues to /login. A still-valid session is left alone
 * (so this URL can't be abused to sign people out).
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });

  if (session) {
    return NextResponse.redirect(new URL(next ?? "/", request.url));
  }

  const target = new URL(LOGIN_PATH, request.url);
  target.searchParams.set("expired", "1");
  if (next && next !== "/") target.searchParams.set("next", next);
  const response = NextResponse.redirect(target);
  clearAuthCookies(
    response.cookies,
    request.cookies.getAll().map((c) => c.name),
  );
  return response;
}
