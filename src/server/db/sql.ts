import type { SQL } from "drizzle-orm";
import type { DbOrTx } from "./create";

/**
 * Runs a raw SQL query and returns typed rows. Works for both drivers
 * (PGlite and node-postgres both return `{ rows }`). Prefer the query builder;
 * use this for search/aggregation SQL the builder can't express nicely.
 */
export async function queryRows<T extends Record<string, unknown>>(db: DbOrTx, query: SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown as { rows: T[] };
  return res.rows;
}
