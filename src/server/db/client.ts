import "server-only";
import { createDatabase, type Db } from "./create";

/**
 * Process-wide database singleton.
 *
 * - DATABASE_URL set (postgres://…)  → node-postgres pool (production / real Postgres)
 * - otherwise                        → embedded PGlite in PGLITE_DATA_DIR (default .data/pglite)
 *
 * The instance is cached on globalThis so Next.js HMR does not open a second PGlite
 * instance on the same data directory (which would corrupt it).
 */
const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__db) {
    globalForDb.__db = createDatabase({ migrate: true });
  }
  return globalForDb.__db;
}

export type { Db, DbOrTx } from "./create";
