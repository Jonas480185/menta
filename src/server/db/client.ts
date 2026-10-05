import "server-only";
import { getEnv } from "@/lib/env";
import { createDatabase, resolveDbDriver, type Db, type DbDriver } from "./create";

/**
 * Process-wide database singleton. The ONLY way app code (services via ctx, route handlers,
 * server actions) should obtain a database.
 *
 * - DATABASE_URL set (postgres://…)  → node-postgres pool (production / real Postgres)
 * - otherwise                        → embedded PGlite in PGLITE_DATA_DIR (default .data/pglite)
 *
 * Lazy: nothing is opened until the first `await getDb()`, never call it at module top level
 * (that would open the database during `next build`).
 *
 * The promise is cached on globalThis so Next.js HMR (which re-evaluates modules) does not open
 * a second PGlite instance on the same data directory. A failed open is not cached: the next
 * call retries.
 */
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__db) {
    globalForDb.__db = createDatabase({ migrate: true }).catch((err: unknown) => {
      globalForDb.__db = undefined;
      throw err;
    });
  }
  return globalForDb.__db;
}

/** Driver getDb() uses (from DATABASE_URL): does not open the database. */
export function getDbDriver(): DbDriver {
  return resolveDbDriver(getEnv().DATABASE_URL);
}

export type { Db, DbOrTx, DbDriver } from "./create";
