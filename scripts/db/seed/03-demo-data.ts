import { and, count, eq, inArray } from "drizzle-orm";
import type { SeedStep } from "./types";
import { createAuth } from "../../../src/server/auth/auth";
import { foods, foodServings, mealEntries, meals, user, waterEntries } from "../../../src/server/db/schema";
import { addDays, todayInTimezone } from "../../../src/lib/dates";
import { completeOnboarding } from "../../../src/server/services/onboarding";
import { addEntry } from "../../../src/server/services/logging";
import { upsertWeight } from "../../../src/server/services/weight";
import { evaluateAchievements } from "../../../src/server/services/engagement";
import type { ServiceContext } from "../../../src/server/context";

export const DEMO_EMAIL = "demo@menta.app";
export const DEMO_PASSWORD = "menta-demo-2026";

/** name → [meal index, serving label regex, quantity, only on days where i % 3 === variant] */
const PLAN: [string, number, RegExp, number, number?][] = [
  ["Haferflocken", 0, /100/, 0.7],
  ["Banane", 0, /Stück/, 1],
  ["Skyr natur", 0, /Becher|100/, 1.5],
  ["Walnüsse", 0, /100/, 0.2],
  ["Hähnchenbrust, gebraten", 1, /100/, 1.8],
  ["Reis, weiß (gekocht)", 1, /100/, 2],
  ["Brokkoli", 1, /100/, 1.5],
  ["Olivenöl", 1, /EL/, 1],
  // dinner rotates over three variants
  ["Vollkornbrot", 2, /Scheibe/, 3, 0],
  ["Gouda", 2, /Scheibe|100/, 2, 0],
  ["Lachs, gebraten", 2, /100/, 1.5, 1],
  ["Kartoffel, roh", 2, /100/, 2.5, 1],
  ["Nudeln (gekocht)", 2, /100/, 2.5, 2],
  ["Thunfisch im eigenen Saft (Dose)", 2, /100|Dose/, 1, 2],
  ["Apfel", 3, /Stück/, 1],
  ["Magerquark", 3, /100/, 2.5],
];

/**
 * Demo account (demo@menta.app / menta-demo-2026) with onboarding done, 21 days of diary,
 * weight trend and water. Idempotent: user found by email, days with entries are skipped.
 */
export const demoDataStep: SeedStep = {
  name: "demo-data",
  description: "demo user with 21 days of sample diary",
  async run({ db, log }) {
    let [u] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL));
    if (!u) {
      const auth = createAuth(db, { secret: "seed-secret-seed-secret-seed-secret-00", baseURL: "http://localhost:3000", nextCookies: false });
      await auth.api.signUpEmail({ body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo" } });
      [u] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL));
    }
    const ctx: ServiceContext = { db, userId: u.id, timezone: "Europe/Berlin" };
    const today = todayInTimezone(ctx.timezone);

    await completeOnboarding(ctx, {
      sex: "male",
      birthDate: "1993-05-12",
      heightCm: 180,
      weightKg: 84,
      targetWeightKg: 78,
      activityLevel: "moderate",
      goalType: "lose",
      goalPace: "moderate",
      calorieTarget: 2300,
      calorieSource: "manual",
      macroMode: "grams",
      grams: { proteinG: 160, fatG: 70 },
    });

    const mealRows = await db.select().from(meals).where(eq(meals.userId, u.id)).orderBy(meals.sortOrder);
    const found = await db
      .select()
      .from(foods)
      .where(and(eq(foods.source, "curated"), inArray(foods.name, PLAN.map((p) => p[0]))));
    const servings = found.length
      ? await db.select().from(foodServings).where(inArray(foodServings.foodId, found.map((f) => f.id)))
      : [];

    let days = 0;
    for (let i = 20; i >= 0; i--) {
      const date = addDays(today, -i);
      const [{ n }] = await db
        .select({ n: count() })
        .from(mealEntries)
        .where(and(eq(mealEntries.userId, u.id), eq(mealEntries.date, date)));
      if (n > 0 || (i % 9 === 4)) continue; // keep a couple of gaps for realism
      for (const [name, mealIdx, re, qty, variant] of PLAN) {
        if (i === 0 && mealIdx >= 2) continue; // today: breakfast + lunch only
        if (variant !== undefined && i % 3 !== variant) continue;
        const food = found.find((f) => f.name === name);
        if (!food || !mealRows[mealIdx]) continue;
        const s = servings.find((x) => x.foodId === food.id && re.test(x.label)) ?? servings.find((x) => x.foodId === food.id && x.isDefault);
        await addEntry(ctx, { date, mealId: mealRows[mealIdx].id, foodId: food.id, servingId: s?.id ?? null, quantity: Math.round(qty * (0.9 + ((i * 7) % 5) / 20) * 100) / 100 });
      }
      await upsertWeight(ctx, { date, weightKg: Math.round((84 - (20 - i) * 0.08 + Math.sin(i) * 0.4) * 10) / 10 });
      await db.insert(waterEntries).values({ userId: u.id, date, amountMl: 1500 + ((i * 250) % 1250) });
      days++;
    }
    // The app evaluates achievements after user actions – do it once for the seeded history.
    const unlocked = await evaluateAchievements(ctx);
    log(`demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}: ${days} days added (${found.length}/${PLAN.length} foods found), ${unlocked.length} achievements unlocked`);
  },
};
