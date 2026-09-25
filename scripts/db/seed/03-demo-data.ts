import type { SeedStep } from "./types";

/**
 * Demo account with realistic history (profile, goal profiles, meals, 30 days of entries,
 * weight trend, water) for local development and screenshots.
 *
 * Intentionally a no-op until auth is merged: users must be created through better-auth
 * (src/server/auth) so the password hash/account rows are valid. After the merge
 * the Lead wires it up here:
 *   1. find-or-create the user by email via better-auth's server API (idempotent),
 *   2. upsert user_profiles / goal_profiles / meals keyed by user,
 *   3. insert entries only for dates that have none yet (keeps the step re-runnable),
 * using the factories' shapes from src/test/factories.ts as reference for valid rows.
 */
export const demoDataStep: SeedStep = {
  name: "demo-data",
  description: "demo user with sample diary (enabled after auth merge)",
  async run() {
    return {
      status: "skipped",
      message:
        "waiting for better-auth integration (Lead wires demo user after merge)",
    };
  },
};
