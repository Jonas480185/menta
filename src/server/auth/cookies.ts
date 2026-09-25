/** Matches every cookie better-auth sets (session token, cookie cache, dont_remember, …). */
const AUTH_COOKIE_RE = /^(__Secure-|__Host-)?better-auth[.-]/;

interface CookieJar {
  getAll(): { name: string }[];
  set(name: string, value: string, options: { path: string; maxAge: number; secure?: boolean }): unknown;
}

/**
 * Expires all better-auth cookies in the given jar (`(await cookies())` in actions/route
 * handlers, or `response.cookies`). Used after account deletion and for stale sessions.
 */
export function clearAuthCookies(jar: CookieJar, names: string[] = jar.getAll().map((c) => c.name)): void {
  for (const name of names) {
    if (!AUTH_COOKIE_RE.test(name)) continue;
    jar.set(name, "", { path: "/", maxAge: 0, secure: name.startsWith("__Secure-") || name.startsWith("__Host-") });
  }
}
