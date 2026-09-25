import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * PGlite creates only the last path segment of its data dir, so a fresh clone without `.data/`
 * fails with ENOENT. Create the parent directories up front (no-op for DATABASE_URL / memory).
 */
export function ensurePgliteDataDir(): void {
  if (
    process.env.DATABASE_URL &&
    /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)
  )
    return;
  const dir =
    process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir.startsWith("memory://")) return;
  mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
}
