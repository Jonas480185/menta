import { sql } from "drizzle-orm";
import { queryRows } from "../../../src/server/db/sql";
import type { SeedStep } from "./types";

const REQUIRED = ["pg_trgm", "unaccent"];

/**
 * Sanity check: the search indexes need pg_trgm (and unaccent is expected by tooling).
 * Migration 0000 creates them; on managed Postgres they may need to be allow-listed first.
 */
export const extensionsStep: SeedStep = {
  name: "extensions",
  description: "verify required Postgres extensions (pg_trgm, unaccent)",
  async run({ db }) {
    const rows = await queryRows<{ extname: string }>(
      db,
      sql`select extname from pg_extension`,
    );
    const missing = REQUIRED.filter((e) => !rows.some((r) => r.extname === e));
    if (missing.length) {
      throw new Error(
        `Missing extensions: ${missing.join(", ")}. Enable them on the server (CREATE EXTENSION …) – see docs/architecture/database.md §10.`,
      );
    }
    return { status: "done", message: REQUIRED.join(", ") };
  },
};
