/**
 * Small helpers shared by the food import CLIs (scripts/food/*.ts).
 */
import { ensurePgliteDataDir } from "../db/data-dir";
import { createDatabase, type Db } from "../../src/server/db/create";
import { formatImportCounts, type ImportCounts } from "../../src/server/food/import/pipeline";

/** `--key=value` / `--flag` → { key: "value", flag: true }. */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [k, ...rest] = a.slice(2).split("=");
    out[k] = rest.length ? rest.join("=") : true;
  }
  return out;
}

export const argString = (args: Record<string, string | true>, key: string, fallback: string): string => {
  const v = args[key];
  return typeof v === "string" && v ? v : fallback;
};

export const argInt = (args: Record<string, string | true>, key: string): number | undefined => {
  const v = args[key];
  if (typeof v !== "string") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Opens the configured database (DATABASE_URL or PGlite data dir) with migrations applied. */
export async function openDb(): Promise<Db> {
  ensurePgliteDataDir();
  return createDatabase({ migrate: true });
}

export function progressLogger(label: string, every = 5000) {
  let next = every;
  return (c: ImportCounts) => {
    if (c.parsed < next) return;
    next = c.parsed + every;
    console.log(`  … ${label}: ${c.parsed} parsed, ${c.inserted + c.updated} stored (${(c.ms / 1000).toFixed(0)} s)`);
  };
}

export function printCounts(label: string, c: ImportCounts) {
  console.log(formatImportCounts(label, c));
}

/** Runs `main`, prints errors, exits (PGlite keeps the event loop alive otherwise). */
export function runCli(main: () => Promise<void>) {
  main().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
