import { sql } from "drizzle-orm";
import { getDb, getDbDriver } from "@/server/db/client";
import { logger } from "@/lib/logger";

/**
 * GET /api/health: liveness + database check (`select 1`).
 * 200 `{ ok: true, db: "pglite" | "postgres", latencyMs }` · 503 `{ ok: false, db, error }`.
 * Never cached; the database is opened lazily on the first request, not at build time.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const started = performance.now();
  let db: ReturnType<typeof getDbDriver> | "unknown" = "unknown";
  try {
    db = getDbDriver();
    const conn = await getDb();
    await conn.execute(sql`select 1`);
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    return Response.json({ ok: true, db, latencyMs }, { headers: NO_STORE });
  } catch (err) {
    logger.error("health check failed", { scope: "health", err });
    return Response.json(
      { ok: false, db, error: err instanceof Error ? err.name : "Error" },
      { status: 503, headers: NO_STORE },
    );
  }
}
