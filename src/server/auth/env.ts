import { env } from "@/lib/env";

/**
 * Auth-related environment, backed by the validated server env (src/lib/env.ts).
 * env enforces BETTER_AUTH_SECRET ≥ 32 chars in production and provides a dev fallback.
 */
export function getAuthSecret(): string {
  if (env.authSecretIsPlaceholder && env.isProduction) {
    console.warn("[auth] BETTER_AUTH_SECRET is a known placeholder – set a real secret.");
  }
  return env.BETTER_AUTH_SECRET;
}

/**
 * Public origin of the app, e.g. https://app.example.com. When unset, better-auth infers it
 * from the incoming request (fine for development on arbitrary ports).
 */
export function getAuthBaseURL(): string | undefined {
  return env.BETTER_AUTH_URL;
}

/** Extra origins allowed to call the auth API (CSRF origin check). */
export function getTrustedOrigins(): string[] {
  // Dev servers may run on any port (e.g. 3100+n); allow any localhost port outside production.
  const dev = env.isProduction ? [] : ["http://localhost:*", "http://127.0.0.1:*"];
  return [...env.BETTER_AUTH_TRUSTED_ORIGINS, ...dev];
}
