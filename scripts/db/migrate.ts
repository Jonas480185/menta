import "dotenv/config";
import { createDatabase } from "../../src/server/db/create";
import { ensurePgliteDataDir } from "./data-dir";

// Applies all pending migrations (PGlite in .data/pglite or DATABASE_URL).
// Stop `pnpm dev` first when using PGlite: only one process may open the data dir.
async function main() {
  ensurePgliteDataDir();
  await createDatabase({ migrate: true });
  console.log("✓ migrations applied");
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
