import type { Db } from "../../../src/server/db/create";

/**
 * A seed step. Steps MUST be idempotent: `pnpm db:seed` is run repeatedly (after every
 * `db:reset`, in CI, by every developer). Use upserts (`onConflictDoNothing/Update`) keyed on
 * natural keys (e.g. foods (source, source_id), user email), never blind inserts.
 */
export interface SeedStep {
  /** kebab-case, used for `pnpm db:seed --only=<name>` and in logs */
  name: string;
  description: string;
  run(ctx: SeedContext): Promise<SeedStepResult | void>;
}

export interface SeedContext {
  db: Db;
  log: (message: string) => void;
}

export interface SeedStepResult {
  /** "skipped" = nothing to do / precondition missing (not an error) */
  status: "done" | "skipped";
  message?: string;
}
