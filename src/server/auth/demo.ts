import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Public demo (DEMO_MODE=true): every visitor shares one seeded account and is signed in
 * automatically (see /api/demo and proxy.ts). Everything that could lock others out or wreck
 * the account is blocked; diary data stays editable so the app can be tried for real.
 */

/** better-auth HTTP endpoints switched off in demo mode (answered with 404). */
export const DEMO_DISABLED_AUTH_PATHS = [
  "/sign-up/email",
  "/change-password",
  "/change-email",
  "/update-user",
  "/delete-user",
  "/request-password-reset",
  "/reset-password",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
];

export function isDemoMode(): boolean {
  return env.DEMO_MODE;
}

/** Guard for server actions that change the account itself. */
export function assertNotDemo(): void {
  if (env.DEMO_MODE) {
    throw new AppError("FORBIDDEN", "In der Demo ist das nicht möglich. Alles andere kannst du gern ausprobieren.");
  }
}
