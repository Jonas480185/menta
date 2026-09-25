import { createDatabase, type Db } from "@/server/db/create";
import { user, userProfiles, meals } from "@/server/db/schema";
import type { ServiceContext } from "@/server/context";

/**
 * Fresh in-memory Postgres (PGlite) with all migrations applied.
 * ~1s startup – create once per test file (beforeAll), not per test.
 */
export async function createTestDb(): Promise<Db> {
  return createDatabase({ pgliteDataDir: "memory://", migrate: true, url: "" });
}

let counter = 0;

/** Inserts a user (+ profile + default meals) and returns a ServiceContext for them. */
export async function createTestUser(
  db: Db,
  overrides: Partial<typeof userProfiles.$inferInsert> = {},
): Promise<ServiceContext & { mealIds: Record<"breakfast" | "lunch" | "dinner" | "snacks", string> }> {
  const id = `test-user-${Date.now()}-${++counter}`;
  await db.insert(user).values({ id, name: "Test User", email: `${id}@example.com` });
  await db.insert(userProfiles).values({ userId: id, ...overrides });
  const rows = await db
    .insert(meals)
    .values([
      { userId: id, name: "Frühstück", sortOrder: 0, icon: "sunrise" },
      { userId: id, name: "Mittagessen", sortOrder: 1, icon: "sun" },
      { userId: id, name: "Abendessen", sortOrder: 2, icon: "moon" },
      { userId: id, name: "Snacks", sortOrder: 3, icon: "cookie" },
    ])
    .returning({ id: meals.id });
  return {
    db,
    userId: id,
    timezone: overrides.timezone ?? "Europe/Berlin",
    mealIds: { breakfast: rows[0].id, lunch: rows[1].id, dinner: rows[2].id, snacks: rows[3].id },
  };
}
