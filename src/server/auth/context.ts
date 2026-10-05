import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSessionCookie } from "better-auth/cookies";
import type { ServiceContext } from "@/server/context";
import { getDb } from "@/server/db/client";
import { userProfiles } from "@/server/db/schema";
import { bootstrapNewUser } from "@/server/services/account/bootstrap";
import { keepDemoDataCurrent } from "@/server/services/demo/keep-current";
import { env } from "@/lib/env";
import { todayInTimezone } from "@/lib/dates";
import { logger } from "@/lib/logger";
import { isDemoMode } from "./demo";
import { getAuth } from "./server";
import { loginPath, ONBOARDING_PATH, PATHNAME_HEADER } from "./redirects";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * CONTRACT. Signatures of getCurrentUser, requireUser and
 * getServiceContext are fixed.
 *
 * Real authorization happens here (proxy.ts only does an optimistic cookie check).
 */

export const DEFAULT_TIMEZONE = "Europe/Berlin";

/** One session lookup per request, no matter how many components ask. */
const getSession = cache(async () => {
  // Read request headers BEFORE touching the DB: this marks the route as dynamic, so
  // prerendering at build time bails out instead of opening the database.
  const requestHeaders = await headers();
  const auth = await getAuth();
  return auth.api.getSession({ headers: requestHeaders });
});

/** Profile fields the auth layer needs; one query per request. Self-heals a missing row. */
const getProfileState = cache(async (userId: string) => {
  const db = await getDb();
  const select = () =>
    db
      .select({ timezone: userProfiles.timezone, onboardingCompletedAt: userProfiles.onboardingCompletedAt })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

  let [row] = await select();
  if (!row) {
    // Signup hook failed or the user predates it: create profile + default meals now.
    await bootstrapNewUser(db, userId);
    [row] = await select();
  }
  return {
    timezone: row?.timezone || DEFAULT_TIMEZONE,
    onboardingCompleted: row?.onboardingCompletedAt != null,
  };
});

/** Current user or null (no redirect). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
}

/**
 * Where to send a request without a valid session. If a (stale) session cookie is still
 * present, proxy.ts would bounce /login straight back into the app, so we route through
 * /session-expired, which clears the cookies first.
 */
async function redirectToLogin(): Promise<never> {
  const h = await headers();
  const next = h.get(PATHNAME_HEADER) ?? undefined;
  if (getSessionCookie(h)) {
    redirect(`/session-expired${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  redirect(loginPath(next));
}

/** Current user; redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) return redirectToLogin();
  return user;
}

/** Service context for the signed-in user (redirects to /login when signed out). */
export async function getServiceContext(): Promise<ServiceContext> {
  const user = await requireUser();
  const [db, profile] = await Promise.all([getDb(), getProfileState(user.id)]);
  const ctx = { db, userId: user.id, timezone: profile.timezone };
  if (isDemoMode() && user.email === env.DEMO_EMAIL) await keepDemoCurrentOncePerDay(ctx);
  return ctx;
}

const globalForDemo = globalThis as unknown as { __demoCurrentOn?: string };

/** Public demo: moves the shared diary to today on the first request of a day (per instance). */
async function keepDemoCurrentOncePerDay(ctx: ServiceContext): Promise<void> {
  const today = todayInTimezone(ctx.timezone);
  if (globalForDemo.__demoCurrentOn === today) return;
  try {
    await keepDemoDataCurrent(ctx, today);
    globalForDemo.__demoCurrentOn = today;
  } catch (err) {
    // Never block the demo over this: the diary just stays on its last day until the next try.
    logger.error("demo diary shift failed", { scope: "demo", err });
  }
}

/** Whether the user finished onboarding (user_profiles.onboarding_completed_at is set). */
export async function getOnboardingStatus(ctx: ServiceContext): Promise<{ completed: boolean }> {
  const [row] = await ctx.db
    .select({ completedAt: userProfiles.onboardingCompletedAt })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId));
  return { completed: row?.completedAt != null };
}

/**
 * Service context for app routes that require a finished onboarding
 * (redirects to /login when signed out, to /onboarding when not onboarded).
 * Intended for the app shell layout and pages under (app)/.
 */
export async function requireOnboardedContext(): Promise<ServiceContext> {
  const ctx = await getServiceContext();
  const profile = await getProfileState(ctx.userId); // cached: no extra query
  if (!profile.onboardingCompleted) redirect(ONBOARDING_PATH);
  return ctx;
}
