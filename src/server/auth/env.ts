/**
 * Auth-related environment. Reads process.env directly for now.
 * Lead: switch to src/lib/env.ts once Technical Architecture's validated env module lands.
 */

const DEV_FALLBACK_SECRET = "dev-only-insecure-better-auth-secret-do-not-use-in-production";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * BETTER_AUTH_SECRET (≥ 32 chars). Missing in production → hard error (sessions would be
 * forgeable). In development/test a fixed fallback keeps `pnpm dev` working out of the box.
 */
export function getAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProduction()) {
    throw new Error(
      "BETTER_AUTH_SECRET fehlt oder ist kürzer als 32 Zeichen. Erzeuge einen mit `openssl rand -base64 32`.",
    );
  }
  if (!secret) {
    console.warn("[auth] BETTER_AUTH_SECRET not set – using an insecure development fallback.");
  }
  return secret ?? DEV_FALLBACK_SECRET;
}

/**
 * Public origin of the app, e.g. https://app.example.com. When unset, better-auth infers it
 * from the incoming request (fine for development on arbitrary ports).
 */
export function getAuthBaseURL(): string | undefined {
  const url = process.env.BETTER_AUTH_URL?.trim();
  return url ? url : undefined;
}

/** Extra origins allowed to call the auth API (CSRF origin check). */
export function getTrustedOrigins(): string[] {
  const fromEnv = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Dev servers may run on any port (e.g. 3100+n); allow any localhost port outside production.
  const dev = isProduction() ? [] : ["http://localhost:*", "http://127.0.0.1:*"];
  return [...fromEnv, ...dev];
}
