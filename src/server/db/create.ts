import path from "node:path";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Use in services that must work both standalone and inside a transaction. */
export type DbOrTx = Db | Tx;

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export interface CreateDatabaseOptions {
  /** postgres:// URL. Falls back to process.env.DATABASE_URL. */
  url?: string;
  /** PGlite data dir, or "memory://" for an in-memory database (tests). */
  pgliteDataDir?: string;
  /** Apply pending migrations on startup. */
  migrate?: boolean;
}

/**
 * Creates a Drizzle instance for either real Postgres or embedded PGlite.
 * Kept free of `server-only` so scripts (seed/import) and tests can use it.
 */
export async function createDatabase(opts: CreateDatabaseOptions = {}): Promise<Db> {
  const url = opts.url ?? process.env.DATABASE_URL;

  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
    const db = drizzle(pool, { schema, casing: "snake_case" });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    return db as unknown as Db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { unaccent } = await import("@electric-sql/pglite/contrib/unaccent");
  const { drizzle } = await import("drizzle-orm/pglite");

  const dataDir =
    opts.pgliteDataDir ?? process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const client = await PGlite.create(dataDir === "memory://" ? undefined : dataDir, {
    extensions: { pg_trgm, unaccent },
  });
  const db = drizzle(client, { schema, casing: "snake_case" });
  if (opts.migrate) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
  return db as unknown as Db;
}
