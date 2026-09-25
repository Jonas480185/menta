import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/server/db/create";
import { meals, userProfiles } from "@/server/db/schema";

/** Default meal slots every new account starts with (see schema/meals.ts). */
export const DEFAULT_MEALS = [
  { name: "Frühstück", icon: "sunrise", sortOrder: 0 },
  { name: "Mittagessen", icon: "sun", sortOrder: 1 },
  { name: "Abendessen", icon: "moon", sortOrder: 2 },
  { name: "Snacks", icon: "cookie", sortOrder: 3 },
] as const;

export interface BootstrapResult {
  /** True when this call created the user_profiles row. */
  createdProfile: boolean;
  /** Number of default meals created by this call (0 or 4). */
  createdMeals: number;
}

/**
 * Creates the per-user rows every account needs: a `user_profiles` row with defaults and
 * the four default meal slots. Goal profiles are NOT created here (onboarding does that).
 *
 * Idempotent and safe to call repeatedly or concurrently:
 * - the profile insert uses ON CONFLICT DO NOTHING; its primary key doubles as a lock, so a
 *   concurrent second call blocks until the first commits,
 * - default meals are only inserted when the user has no meal rows at all (archived ones
 *   count, so a user who archived everything doesn't get the defaults back).
 *
 * Called from the better-auth `user.create.after` hook and, as a self-healing fallback,
 * from getServiceContext() when a signed-in user has no profile row.
 */
export async function bootstrapNewUser(db: DbOrTx, userId: string): Promise<BootstrapResult> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(userProfiles)
      .values({ userId })
      .onConflictDoNothing({ target: userProfiles.userId })
      .returning({ userId: userProfiles.userId });

    const existingMeal = await tx
      .select({ id: meals.id })
      .from(meals)
      .where(eq(meals.userId, userId))
      .limit(1);

    let createdMeals = 0;
    if (existingMeal.length === 0) {
      const rows = await tx
        .insert(meals)
        .values(DEFAULT_MEALS.map((m) => ({ ...m, userId })))
        .returning({ id: meals.id });
      createdMeals = rows.length;
    }

    return { createdProfile: inserted.length > 0, createdMeals };
  });
}
