import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { HOME_PATH, safeNextPath } from "@/server/auth/redirects";
import { getAuth } from "@/server/auth/server";

/**
 * GET /api/demo?next=/diary: signs the visitor in to the shared demo account and redirects
 * (DEMO_MODE only, 404 otherwise). proxy.ts sends every signed-out visitor here, so the
 * public demo never shows a login screen.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.DEMO_MODE) return new Response("Not Found", { status: 404 });

  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next")) ?? HOME_PATH;
  try {
    const auth = await getAuth();
    const signIn = await auth.api.signInEmail({
      body: { email: env.DEMO_EMAIL, password: env.DEMO_PASSWORD, rememberMe: true },
      headers: request.headers,
      asResponse: true,
    });
    if (!signIn.ok) throw new Error(`demo sign-in failed with ${signIn.status}`);

    const headers = new Headers({ Location: new URL(next, url).toString(), "Cache-Control": "no-store" });
    for (const cookie of signIn.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    return new Response(null, { status: 303, headers });
  } catch (err) {
    logger.error("demo sign-in failed", { scope: "demo", err });
    return new Response("Die Demo ist gerade nicht erreichbar. Bitte versuche es später noch einmal.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
