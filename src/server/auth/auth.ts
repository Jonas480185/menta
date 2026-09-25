import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "@/server/db/create";
import { account, session, user, verification } from "@/server/db/schema";
import { bootstrapNewUser } from "@/server/services/account/bootstrap";
import { getAuthBaseURL, getAuthSecret, getTrustedOrigins } from "./env";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const DAY = 60 * 60 * 24;
/** Sessions live 30 days and are extended (rolling) at most once per day of activity. */
export const SESSION_EXPIRES_IN = 30 * DAY;
export const SESSION_UPDATE_AGE = DAY;

export interface CreateAuthOptions {
  secret?: string;
  baseURL?: string;
  /** Include the Next.js cookie plugin (default true). Tests outside Next can keep it – it no-ops. */
  nextCookies?: boolean;
}

/**
 * Builds the better-auth instance for a database. Pure factory (no `server-only`) so tests
 * can run the real auth API against an in-memory PGlite; the app uses the memoized
 * `getAuth()` from ./server.ts.
 *
 * Drizzle adapter: better-auth addresses fields by their JS keys (emailVerified, userId, …),
 * which our schema defines 1:1; the snake_case column names are handled by Drizzle.
 */
export function createAuth(db: Db, opts: CreateAuthOptions = {}) {
  return betterAuth({
    appName: "Nutrition",
    secret: opts.secret ?? getAuthSecret(),
    baseURL: opts.baseURL ?? getAuthBaseURL(),
    trustedOrigins: getTrustedOrigins(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      autoSignIn: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: SESSION_UPDATE_AGE,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (created) => {
            // Profile + default meals. Failures are logged, not rethrown: the account already
            // exists at this point, and getServiceContext() self-heals a missing profile.
            try {
              await bootstrapNewUser(db, created.id);
            } catch (err) {
              console.error("[auth] bootstrapNewUser failed", { userId: created.id, err });
            }
          },
        },
      },
    },
    // nextCookies must be the last plugin.
    plugins: opts.nextCookies === false ? [] : [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
