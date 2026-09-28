import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { inTransaction, type ServiceContext } from "@/server/context";
import { foods, foodServings, mealEntries, meals, recipes } from "@/server/db/schema";
import { computeEntryNutrients } from "@/domain/nutrition";
import { ISO_DATE_RE } from "@/lib/dates";
import { AppError, notFound } from "@/lib/errors";
import { ensureDailyNutrition } from "@/server/services/nutrition";
import { recordFoodUsage } from "@/server/services/foods";

type Tx = ServiceContext;
type EntryRow = typeof mealEntries.$inferSelect;

const isoDate = z.string().regex(ISO_DATE_RE, "Ungültiges Datum");

export const entryInputSchema = z.object({
  date: isoDate,
  mealId: z.uuid(),
  foodId: z.uuid(),
  /** null → per 100 g/ml ("100 g" serving semantics). */
  servingId: z.uuid().nullable(),
  quantity: z.number().positive("Menge muss größer als 0 sein").max(10_000),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

async function assertMeal(tx: Tx, mealId: string) {
  const [m] = await tx.db
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.id, mealId), eq(meals.userId, tx.userId)));
  if (!m) throw notFound("Mahlzeit");
}

/** Computes the nutrient snapshot for food × serving × quantity. */
async function buildSnapshot(tx: Tx, foodId: string, servingId: string | null, quantity: number) {
  const [food] = await tx.db.select().from(foods).where(eq(foods.id, foodId));
  if (!food || (food.ownerUserId && food.ownerUserId !== tx.userId)) throw notFound("Lebensmittel");
  let servingLabel = food.nutrientBasis === "ml" ? "100 ml" : "100 g";
  let servingGrams = 100;
  if (servingId) {
    const [s] = await tx.db
      .select()
      .from(foodServings)
      .where(and(eq(foodServings.id, servingId), eq(foodServings.foodId, foodId)));
    if (!s) throw new AppError("VALIDATION", "Portion passt nicht zum Lebensmittel.");
    servingLabel = s.label;
    servingGrams = s.grams;
  }
  const { grams, totals } = computeEntryNutrients({ per100: food, servingGrams, quantity });
  const [recipe] =
    food.source === "recipe"
      ? await tx.db.select({ id: recipes.id }).from(recipes).where(eq(recipes.foodId, food.id))
      : [];
  return {
    foodId: food.id,
    recipeId: recipe?.id ?? null,
    servingId,
    foodName: food.name,
    brandName: food.brandName,
    servingLabel,
    servingGrams,
    quantity,
    grams,
    kcal: totals.kcal,
    proteinG: totals.proteinG,
    carbsG: totals.carbsG,
    fatG: totals.fatG,
    fiberG: totals.fiberG,
    sugarG: totals.sugarG,
    saturatedFatG: totals.saturatedFatG,
    sodiumMg: totals.sodiumMg,
  };
}

async function nextSortOrder(tx: Tx, date: string, mealId: string) {
  const [r] = await tx.db
    .select({ m: max(mealEntries.sortOrder) })
    .from(mealEntries)
    .where(and(eq(mealEntries.userId, tx.userId), eq(mealEntries.date, date), eq(mealEntries.mealId, mealId)));
  return (r?.m ?? -1) + 1;
}

async function getOwnEntry(tx: Tx, id: string): Promise<EntryRow> {
  const [e] = await tx.db
    .select()
    .from(mealEntries)
    .where(and(eq(mealEntries.id, id), eq(mealEntries.userId, tx.userId)));
  if (!e) throw notFound("Eintrag");
  return e;
}

export async function addEntry(ctx: ServiceContext, input: EntryInput): Promise<EntryRow> {
  const data = entryInputSchema.parse(input);
  return inTransaction(ctx, async (tx) => {
    await assertMeal(tx, data.mealId);
    const snap = await buildSnapshot(tx, data.foodId, data.servingId, data.quantity);
    const [row] = await tx.db
      .insert(mealEntries)
      .values({
        ...snap,
        userId: tx.userId,
        date: data.date,
        mealId: data.mealId,
        sortOrder: await nextSortOrder(tx, data.date, data.mealId),
      })
      .returning();
    await ensureDailyNutrition(tx, data.date);
    await recordFoodUsage(tx.db, tx.userId, {
      foodId: data.foodId,
      servingId: data.servingId,
      quantity: data.quantity,
      mealId: data.mealId,
    });
    return row;
  });
}

export async function updateEntry(
  ctx: ServiceContext,
  id: string,
  input: Partial<Pick<EntryInput, "servingId" | "quantity" | "mealId" | "date">>,
): Promise<EntryRow> {
  return inTransaction(ctx, async (tx) => {
    const cur = await getOwnEntry(tx, id);
    const patch = entryInputSchema.partial().parse(input);
    const mealId = patch.mealId ?? cur.mealId;
    const date = patch.date ?? cur.date;
    if (patch.mealId) await assertMeal(tx, mealId);
    const servingId = patch.servingId !== undefined ? patch.servingId : cur.servingId;
    const quantity = patch.quantity ?? cur.quantity;
    // Recompute from the food when it still exists; otherwise scale the old snapshot.
    const snap = cur.foodId
      ? await buildSnapshot(tx, cur.foodId, servingId, quantity)
      : scaleSnapshot(cur, quantity);
    const [row] = await tx.db
      .update(mealEntries)
      .set({ ...snap, mealId, date })
      .where(eq(mealEntries.id, id))
      .returning();
    if (date !== cur.date) await ensureDailyNutrition(tx, date);
    return row;
  });
}

function scaleSnapshot(cur: EntryRow, quantity: number) {
  const f = quantity / cur.quantity;
  const s = (v: number | null) => (v == null ? null : v * f);
  return {
    quantity,
    grams: cur.servingGrams * quantity,
    kcal: cur.kcal * f,
    proteinG: cur.proteinG * f,
    carbsG: cur.carbsG * f,
    fatG: cur.fatG * f,
    fiberG: s(cur.fiberG),
    sugarG: s(cur.sugarG),
    saturatedFatG: s(cur.saturatedFatG),
    sodiumMg: s(cur.sodiumMg),
  };
}

/** Deletes an entry and returns it so the UI can offer "Rückgängig" via restoreEntry. */
export async function deleteEntry(ctx: ServiceContext, id: string): Promise<EntryRow> {
  const row = await getOwnEntry(ctx, id);
  await ctx.db.delete(mealEntries).where(eq(mealEntries.id, id));
  return row;
}

export async function restoreEntry(ctx: ServiceContext, row: EntryRow): Promise<void> {
  if (row.userId !== ctx.userId) throw notFound("Eintrag");
  await assertMeal(ctx, row.mealId);
  await ctx.db.insert(mealEntries).values(row).onConflictDoNothing();
}

export async function duplicateEntry(ctx: ServiceContext, id: string): Promise<EntryRow> {
  const cur = await getOwnEntry(ctx, id);
  const { id: _id, createdAt: _c, updatedAt: _u, loggedAt: _l, ...rest } = cur;
  void [_id, _c, _u, _l];
  const [row] = await ctx.db
    .insert(mealEntries)
    .values({ ...rest, sortOrder: await nextSortOrder(ctx, cur.date, cur.mealId) })
    .returning();
  return row;
}

/** Copies entries (snapshots) of one meal or a whole day to another date/meal. */
export async function copyEntries(
  ctx: ServiceContext,
  from: { date: string; mealId?: string },
  to: { date: string; mealId?: string },
): Promise<number> {
  isoDate.parse(from.date);
  isoDate.parse(to.date);
  return inTransaction(ctx, async (tx) => {
    const where = [eq(mealEntries.userId, tx.userId), eq(mealEntries.date, from.date)];
    if (from.mealId) where.push(eq(mealEntries.mealId, from.mealId));
    const src = await tx.db.select().from(mealEntries).where(and(...where)).orderBy(asc(mealEntries.sortOrder));
    if (!src.length) return 0;
    if (to.mealId) await assertMeal(tx, to.mealId);
    const values = src.map(({ id: _id, createdAt: _c, updatedAt: _u, loggedAt: _l, ...rest }) => {
      void [_id, _c, _u, _l];
      return { ...rest, date: to.date, mealId: to.mealId ?? rest.mealId };
    });
    await tx.db.insert(mealEntries).values(values);
    await ensureDailyNutrition(tx, to.date);
    return values.length;
  });
}

// ── Meal slots (Frühstück, …) ──────────────────────────────────────────────

export async function listMeals(ctx: ServiceContext) {
  return ctx.db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, ctx.userId), eq(meals.isArchived, false)))
    .orderBy(asc(meals.sortOrder));
}

const mealNameSchema = z.string().trim().min(1, "Name fehlt").max(40);

export async function createMeal(ctx: ServiceContext, name: string) {
  const [r] = await ctx.db
    .select({ m: max(meals.sortOrder) })
    .from(meals)
    .where(eq(meals.userId, ctx.userId));
  const [row] = await ctx.db
    .insert(meals)
    .values({ userId: ctx.userId, name: mealNameSchema.parse(name), sortOrder: (r?.m ?? -1) + 1 })
    .returning();
  return row;
}

export async function renameMeal(ctx: ServiceContext, id: string, name: string) {
  const [row] = await ctx.db
    .update(meals)
    .set({ name: mealNameSchema.parse(name) })
    .where(and(eq(meals.id, id), eq(meals.userId, ctx.userId)))
    .returning();
  if (!row) throw notFound("Mahlzeit");
  return row;
}

export async function archiveMeal(ctx: ServiceContext, id: string) {
  const active = await listMeals(ctx);
  if (active.length <= 1) throw new AppError("VALIDATION", "Mindestens eine Mahlzeit muss bleiben.");
  await ctx.db
    .update(meals)
    .set({ isArchived: true })
    .where(and(eq(meals.id, id), eq(meals.userId, ctx.userId)));
}

export async function moveMeal(ctx: ServiceContext, id: string, direction: -1 | 1) {
  const list = await listMeals(ctx);
  const i = list.findIndex((m) => m.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  await inTransaction(ctx, async (tx) => {
    await tx.db.update(meals).set({ sortOrder: list[j].sortOrder }).where(eq(meals.id, list[i].id));
    await tx.db.update(meals).set({ sortOrder: list[i].sortOrder }).where(eq(meals.id, list[j].id));
  });
}

/** Meal slot that fits the current hour best (for preselection when logging). */
export function suggestMealId(list: { id: string; name: string }[], hour: number): string | undefined {
  const byName = (re: RegExp) => list.find((m) => re.test(m.name))?.id;
  if (hour < 10) return byName(/früh/i) ?? list[0]?.id;
  if (hour >= 11 && hour < 15) return byName(/mittag/i);
  if (hour >= 17 && hour < 22) return byName(/abend/i);
  return byName(/snack/i) ?? list.at(-1)?.id;
}

