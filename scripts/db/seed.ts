import "dotenv/config";
import { performance } from "node:perf_hooks";
import { createDatabase } from "../../src/server/db/create";
import { ensurePgliteDataDir } from "./data-dir";
import { runSeed, SEED_STEPS } from "./seed/index";

// Idempotent seed runner: `pnpm db:seed` (all steps) or `pnpm db:seed --only=foods,demo-data`.
// Steps live in scripts/db/seed/*.ts. Stop `pnpm dev` first when using PGlite: only one
// process may open the data dir.
async function main() {
  const only = process.argv
    .find((a) => a.startsWith("--only="))
    ?.slice("--only=".length)
    .split(",")
    .filter(Boolean);
  const t0 = performance.now();
  ensurePgliteDataDir();
  const db = await createDatabase({ migrate: true });
  await runSeed(db, SEED_STEPS, { only });
  console.log(
    `✓ seed complete in ${((performance.now() - t0) / 1000).toFixed(1)} s`,
  );
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
