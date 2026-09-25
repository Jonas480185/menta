/**
 * Route constants + redirect helpers shared by proxy.ts, auth pages and server code.
 * Pure module: safe in proxy, client components and tests.
 */

export const LOGIN_PATH = "/login";
export const SIGNUP_PATH = "/signup";
export const ONBOARDING_PATH = "/onboarding";
export const HOME_PATH = "/today";

/** Request header set by proxy.ts carrying the original path + query (for `?next=`). */
export const PATHNAME_HEADER = "x-pathname";

/** Top-level segments that require a session (see docs/ARCHITECTURE.md §8). */
export const PROTECTED_PREFIXES = [
  "/today",
  "/diary",
  "/log",
  "/scan",
  "/foods",
  "/recipes",
  "/progress",
  "/activity",
  "/achievements",
  "/settings",
  "/onboarding",
] as const;

/** Pages only meant for signed-out visitors. */
export const AUTH_PAGES = [LOGIN_PATH, SIGNUP_PATH] as const;

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => matchesPrefix(pathname, p));
}

/**
 * Validates a `?next=` value: only same-origin absolute paths, never back to an auth page.
 * Returns null for anything suspicious ("//evil.com", "/\\evil.com", "https://…", …).
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw, "http://internal.invalid");
  } catch {
    return null;
  }
  if (parsed.origin !== "http://internal.invalid") return null;
  if (isAuthPage(parsed.pathname)) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** "/login" or "/login?next=%2Fdiary" */
export function loginPath(next?: string | null): string {
  const safe = safeNextPath(next);
  return safe && safe !== "/" ? `${LOGIN_PATH}?next=${encodeURIComponent(safe)}` : LOGIN_PATH;
}
