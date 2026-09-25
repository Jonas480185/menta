import "dotenv/config";
import { createDatabase } from "../../src/server/db/create";

// FOUNDATION STUB – Database (DB) + Food Data Import extend this with the food
// seed pipeline and a demo user. Must be idempotent (safe to run twice).
async function main() {
  await createDatabase({ migrate: true });
  console.log("✓ seed complete (nothing to seed yet)");
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
