import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { inTransaction, type ServiceContext } from "@/server/context";
import { foods, foodServings } from "@/server/db/schema";
import { normalizeFoodText } from "@/domain/food/normalize";
import { validateNutrients } from "@/domain/food/validation";
import { normalizeBarcode } from "@/domain/food/barcode";
import { AppError, notFound } from "@/lib/errors";

const opt = z.number().min(0).nullable().optional();

export const userFoodSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt").max(120),
  brandName: z.string().trim().max(80).nullable().optional(),
  barcode: z.string().trim().max(20).nullable().optional(),
  basis: z.enum(["g", "ml"]).default("g"),
  /** Values are entered per serving; stored per 100 g/ml. */
  servingLabel: z.string().trim().min(1).max(40).default("1 Portion"),
  servingGrams: z.number().positive("Portionsgröße muss größer als 0 sein").max(5000),
  kcal: z.number().min(0, "Kalorien dürfen nicht negativ sein").max(20000),
  proteinG: z.number().min(0).max(5000),
  carbsG: z.number().min(0).max(5000),
  fatG: z.number().min(0).max(5000),
  fiberG: opt,
  sugarG: opt,
  saltG: opt,
});
export type UserFoodInput = z.input<typeof userFoodSchema>;

function per100(input: z.output<typeof userFoodSchema>) {
  const f = 100 / input.servingGrams;
  const s = (v: number | null | undefined) => (v == null ? null : v * f);
  const nutrients = {
    kcal: input.kcal * f,
    proteinG: input.proteinG * f,
    carbsG: input.carbsG * f,
    fatG: input.fatG * f,
    fiberG: s(input.fiberG),
    sugarG: s(input.sugarG),
    saltG: s(input.saltG),
  };
  const v = validateNutrients(nutrients, { basis: input.basis });
  if (!v.valid) {
    throw new AppError("VALIDATION", v.errors[0]?.message ?? "Nährwerte sind nicht plausibel.", {
      kcal: v.errors.map((e) => e.message),
    });
  }
  return { nutrients: v.nutrients, quality: v.quality, flags: v.flags };
}

function rowValues(ctx: ServiceContext, input: z.output<typeof userFoodSchema>) {
  const { nutrients, quality, flags } = per100(input);
  return {
    source: "user" as const,
    ownerUserId: ctx.userId,
    visibility: "private" as const,
    name: input.name,
    nameNormalized: normalizeFoodText(input.name),
    brandName: input.brandName || null,
    brandNormalized: input.brandName ? normalizeFoodText(input.brandName) : null,
    barcode: input.barcode ? (normalizeBarcode(input.barcode) ?? input.barcode) : null,
    nutrientBasis: input.basis,
    kcal: nutrients.kcal,
    proteinG: nutrients.proteinG,
    carbsG: nutrients.carbsG,
    fatG: nutrients.fatG,
    fiberG: nutrients.fiberG ?? null,
    sugarG: nutrients.sugarG ?? null,
    saltG: nutrients.saltG ?? null,
    sodiumMg: nutrients.sodiumMg ?? null,
    dataQuality: quality,
    qualityFlags: flags,
  };
}

async function writeServings(ctx: ServiceContext, foodId: string, input: z.output<typeof userFoodSchema>) {
  await ctx.db.delete(foodServings).where(eq(foodServings.foodId, foodId));
  const base = `100 ${input.basis}`;
  await ctx.db.insert(foodServings).values([
    { foodId, label: input.servingLabel, amount: 1, unit: "serving", grams: input.servingGrams, isDefault: true, sortOrder: 0 },
    { foodId, label: base, amount: 100, unit: input.basis, grams: 100, isDefault: false, sortOrder: 1 },
  ]);
}

export async function createUserFood(ctx: ServiceContext, raw: UserFoodInput) {
  const input = userFoodSchema.parse(raw);
  return inTransaction(ctx, async (tx) => {
    const [row] = await tx.db.insert(foods).values(rowValues(tx, input)).returning();
    await writeServings(tx, row.id, input);
    return row;
  });
}

async function getOwn(ctx: ServiceContext, id: string) {
  const [row] = await ctx.db
    .select()
    .from(foods)
    .where(and(eq(foods.id, id), eq(foods.ownerUserId, ctx.userId), eq(foods.source, "user")));
  if (!row) throw notFound("Lebensmittel");
  return row;
}

export async function updateUserFood(ctx: ServiceContext, id: string, raw: UserFoodInput) {
  const input = userFoodSchema.parse(raw);
  await getOwn(ctx, id);
  return inTransaction(ctx, async (tx) => {
    const [row] = await tx.db.update(foods).set(rowValues(tx, input)).where(eq(foods.id, id)).returning();
    await writeServings(tx, id, input);
    return row;
  });
}

/** Archives (soft-deletes) – diary entries and recipes keep working. */
export async function archiveUserFood(ctx: ServiceContext, id: string) {
  await getOwn(ctx, id);
  await ctx.db.update(foods).set({ isArchived: true }).where(eq(foods.id, id));
}

export async function listUserFoods(ctx: ServiceContext) {
  return ctx.db
    .select()
    .from(foods)
    .where(and(eq(foods.ownerUserId, ctx.userId), eq(foods.source, "user"), eq(foods.isArchived, false)))
    .orderBy(desc(foods.updatedAt));
}

/** Form values (per default serving) for editing. */
export async function getUserFoodForm(ctx: ServiceContext, id: string): Promise<z.output<typeof userFoodSchema>> {
  const f = await getOwn(ctx, id);
  const [s] = await ctx.db
    .select()
    .from(foodServings)
    .where(and(eq(foodServings.foodId, id), eq(foodServings.isDefault, true)));
  const grams = s?.grams ?? 100;
  const k = grams / 100;
  const r = (v: number | null) => (v == null ? null : Math.round(v * k * 10) / 10);
  return {
    name: f.name,
    brandName: f.brandName,
    barcode: f.barcode,
    basis: f.nutrientBasis,
    servingLabel: s?.label ?? `100 ${f.nutrientBasis}`,
    servingGrams: grams,
    kcal: Math.round(f.kcal * k),
    proteinG: r(f.proteinG)!,
    carbsG: r(f.carbsG)!,
    fatG: r(f.fatG)!,
    fiberG: r(f.fiberG),
    sugarG: r(f.sugarG),
    saltG: r(f.saltG),
  };
}
