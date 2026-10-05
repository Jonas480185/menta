import fs from "node:fs";
import path from "node:path";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Use in services that must work both standalone and inside a transaction. */
export type DbOrTx = Db | Tx;
export type DbDriver = "pglite" | "postgres";

// Statically scoped so Next's output tracing includes the migrations folder.
export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export interface CreateDatabaseOptions {
  /** postgres:// URL. Falls back to DATABASE_URL. Pass "" to force PGlite. */
  url?: string;
  /** PGlite data dir, or "memory://" for an in-memory database (tests). Falls back to PGLITE_DATA_DIR. */
  pgliteDataDir?: string;
  /** Apply pending migrations on startup. */
  migrate?: boolean;
}

const log = logger.child({ scope: "db" });

/** Which driver createDatabase() would pick for the given URL (does not connect). */
export function resolveDbDriver(url: string | undefined): DbDriver {
  return url && /^postgres(ql)?:\/\//.test(url) ? "postgres" : "pglite";
}

/**
 * node-postgres connection options. With a provider CA the certificate is verified against it
 * (`rejectUnauthorized: true`, hostname checked). The `ssl*` URL parameters are dropped in that
 * case because node-postgres lets them override the `ssl` object, and `sslmode=require` alone
 * would verify against Node's default roots only, which fails for providers with their own CA.
 */
export function postgresConnectionOptions(
  url: string,
  sslCa: string | undefined,
): { connectionString: string; ssl?: { ca: string; rejectUnauthorized: true } } {
  if (!sslCa) return { connectionString: url };
  const parsed = new URL(url);
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith("ssl")) parsed.searchParams.delete(key);
  }
  return { connectionString: parsed.toString(), ssl: { ca: sslCa, rejectUnauthorized: true } };
}

/**
 * Creates a Drizzle instance for either real Postgres or embedded PGlite.
 * Kept free of `server-only` so scripts (seed/import) and tests can use it.
 *
 * App code must NOT call this: use `getDb()` from ./client (process-wide singleton).
 * Each call opens a new connection pool / PGlite instance.
 */
export async function createDatabase(opts: CreateDatabaseOptions = {}): Promise<Db> {
  const url = opts.url ?? getEnv().DATABASE_URL;
  const started = performance.now();

  if (resolveDbDriver(url) === "postgres") {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      ...postgresConnectionOptions(url!, getEnv().DATABASE_SSL_CA),
      max: getEnv().DB_POOL_MAX,
    });
    const db = drizzle(pool, { schema, casing: "snake_case" });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    log.info("postgres ready", { ms: Math.round(performance.now() - started) });
    return db as unknown as Db;
  }

  const dataDir = opts.pgliteDataDir ?? getEnv().PGLITE_DATA_DIR;
  const inMemory = dataDir === "memory://";

  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { unaccent } = await import("@electric-sql/pglite/contrib/unaccent");
  const { drizzle } = await import("drizzle-orm/pglite");

  let absDir: string | undefined;
  if (!inMemory) {
    absDir = path.resolve(/*turbopackIgnore: true*/ dataDir);
    // PGlite only creates the leaf directory; make sure `.data/` exists on a fresh checkout.
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(absDir), { recursive: true });
    // PGlite has no inter-process locking: a second process silently corrupts the data dir.
    acquireDataDirLock(absDir);
  }

  let db: Db;
  try {
    const client = await PGlite.create(absDir, { extensions: { pg_trgm, unaccent } });
    const pgliteDb = drizzle(client, { schema, casing: "snake_case" });
    if (opts.migrate) {
      const { migrate } = await import("drizzle-orm/pglite/migrator");
      await migrate(pgliteDb, { migrationsFolder: MIGRATIONS_FOLDER });
    }
    db = pgliteDb as unknown as Db;
  } catch (err) {
    if (absDir) releaseDataDirLock(absDir);
    throw err;
  }
  if (!inMemory) {
    log.info("pglite ready", { dataDir: absDir, ms: Math.round(performance.now() - started) });
  }
  return db;
}

// ── PGlite data-dir lock ──────────────────────────────────────────────────────
//
// PGlite (Postgres-in-WASM) does not lock its data directory. If `pnpm dev` and
// `pnpm db:seed` (or `next start`) open the same directory, both run happily and the
// directory is corrupted afterwards (`RuntimeError: Aborted()` on the next open:
// verified with @electric-sql/pglite 0.5.8). This advisory PID lock
// (`<dataDir>.lock` next to the directory) turns that into an immediate, explicit error.
// Stale locks (dead process, e.g. after SIGKILL) are taken over; released on exit.

const globalForLocks = globalThis as unknown as { __pgliteLocks?: Set<string>; __pgliteExitHook?: boolean };
const heldLocks = (globalForLocks.__pgliteLocks ??= new Set<string>());

export class DataDirLockedError extends Error {
  constructor(
    public readonly dataDir: string,
    public readonly pid: number,
  ) {
    super(
      pid === process.pid
        ? `PGlite data dir ${dataDir} is already open in this process: use getDb() instead of createDatabase().`
        : `PGlite data dir ${dataDir} is in use by process ${pid}. PGlite allows only ONE process per data ` +
            `dir: stop the other process (usually \`pnpm dev\` / \`pnpm start\`) before running db scripts.`,
    );
    this.name = "DataDirLockedError";
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process exists but belongs to another user.
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function lockPathFor(dataDir: string): string {
  return `${dataDir.replace(/[/\\]+$/, "")}.lock`;
}

/** Takes the advisory lock for `dataDir` or throws DataDirLockedError. */
export function acquireDataDirLock(dataDir: string): void {
  const lockPath = lockPathFor(dataDir);
  if (heldLocks.has(lockPath)) throw new DataDirLockedError(dataDir, process.pid);
  try {
    fs.writeFileSync(/*turbopackIgnore: true*/ lockPath, String(process.pid), { flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    const pid = Number.parseInt(fs.readFileSync(/*turbopackIgnore: true*/ lockPath, "utf8").trim(), 10);
    if (Number.isInteger(pid) && pid !== process.pid && isProcessAlive(pid)) {
      throw new DataDirLockedError(dataDir, pid);
    }
    fs.writeFileSync(/*turbopackIgnore: true*/ lockPath, String(process.pid)); // stale → take over
  }
  heldLocks.add(lockPath);
  if (!globalForLocks.__pgliteExitHook) {
    globalForLocks.__pgliteExitHook = true;
    process.once("exit", () => {
      for (const held of [...heldLocks]) releaseDataDirLock(held.slice(0, -".lock".length));
    });
  }
}

export function releaseDataDirLock(dataDir: string): void {
  const lockPath = lockPathFor(dataDir);
  if (!heldLocks.delete(lockPath)) return;
  try {
    const owner = fs.readFileSync(/*turbopackIgnore: true*/ lockPath, "utf8").trim();
    if (owner === String(process.pid)) fs.unlinkSync(/*turbopackIgnore: true*/ lockPath);
  } catch {
    // already gone
  }
}
