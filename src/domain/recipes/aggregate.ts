import type { NutrientBasis, NutrientProfile } from "@/domain/nutrition/types";

/**
 * Recipe nutrition math (pure).
 *
 * A recipe is a list of ingredients (each: nutrients per 100 units of its basis + the amount
 * used in base units) cooked into `servings` portions. Totals are the plain sum of every
 * ingredient's contribution. The optional cooked weight (`totalWeightG`) only changes how
 * dense the dish is, i.e. the per-100 g values and the grams of one portion, never the
 * totals or the nutrients of one portion (water evaporates, nutrients don't).
 *
 * Optional nutrients (fiber, sugar, …) follow "sum of known" semantics: ingredients without a
 * value are skipped; the total is null only when NO ingredient has a value. Keys where some but
 * not all ingredients carry a value are reported in `incomplete` so the UI can say "mind.".
 */

export const OPTIONAL_RECIPE_NUTRIENTS = [
  "fiberG",
  "sugarG",
  "saturatedFatG",
  "saltG",
  "sodiumMg",
  "potassiumMg",
  "calciumMg",
  "ironMg",
] as const;

export type OptionalRecipeNutrient = (typeof OPTIONAL_RECIPE_NUTRIENTS)[number];

/** Nutrients of a recipe quantity (totals, one portion or 100 g). kcal, g, mg. */
export interface RecipeNutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  saltG: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
}

export interface RecipeIngredientNutritionInput {
  /** Nutrients per 100 units of the ingredient's basis (100 g or 100 ml). */
  per100: NutrientProfile;
  /** Amount used, in base units of the basis (g, or ml for liquids). */
  grams: number;
  /** Default "g". For "ml" the weight contribution uses `densityGPerMl` (default 1 g/ml). */
  basis?: NutrientBasis;
  densityGPerMl?: number | null;
}

export interface AggregateRecipeInput {
  ingredients: readonly RecipeIngredientNutritionInput[];
  /** Number of portions the recipe yields (> 0, may be fractional). */
  servings: number;
  /** Cooked total weight in g. Null/undefined → sum of the raw ingredient weights. */
  totalWeightG?: number | null;
}

export interface RecipeAggregate {
  totals: RecipeNutrients;
  perServing: RecipeNutrients;
  /** Per 100 g of the finished dish (cooked weight if given, else raw weight). */
  per100g: RecipeNutrients;
  /** Weight of the finished dish in g (cooked weight if given, else raw weight). */
  totalWeightG: number;
  /** Sum of the ingredient weights in g (before cooking). */
  rawWeightG: number;
  /** Grams of one portion = totalWeightG / servings. */
  servingGrams: number;
  /** Whether `totalWeightG` came from an explicit cooked weight. */
  hasCookedWeight: boolean;
  /**
   * Smallest cooked weight for which the per-100 g values stay physically plausible
   * (≤ 1000 kcal, ≤ 100 g per nutrient, P+C+F ≤ 105 g per 100 g: same limits as the foods table).
   */
  minTotalWeightG: number;
  /** Optional nutrients known for some but not all ingredients (totals are a lower bound). */
  incomplete: OptionalRecipeNutrient[];
}

/**
 * Thrown for invalid recipe input. `message` is German and user-presentable; `field` names the
 * offending input path ("servings", "totalWeightG", "ingredients.2.grams") so services can map it
 * to AppError("VALIDATION", message, { [field]: [message] }).
 */
export class RecipeInputError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "RecipeInputError";
  }
}

export function isRecipeInputError(err: unknown): err is RecipeInputError {
  if (err instanceof RecipeInputError) return true;
  return (
    err instanceof Error &&
    err.name === "RecipeInputError" &&
    typeof (err as Error & { field?: unknown }).field === "string"
  );
}

/** Per-100 g plausibility limits of the foods table (see foods_nutrients_plausible). */
export const PER100_LIMITS = { kcal: 1000, singleNutrientG: 100, macroSumG: 105 } as const;

const isNonNegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

function zeroNutrients(): RecipeNutrients {
  return {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
    saltG: null,
    sodiumMg: null,
    potassiumMg: null,
    calciumMg: null,
    ironMg: null,
  };
}

/** Multiplies every (non-null) nutrient by `factor`. */
export function scaleNutrients(n: RecipeNutrients, factor: number): RecipeNutrients {
  const out = zeroNutrients();
  out.kcal = n.kcal * factor;
  out.proteinG = n.proteinG * factor;
  out.carbsG = n.carbsG * factor;
  out.fatG = n.fatG * factor;
  for (const key of OPTIONAL_RECIPE_NUTRIENTS) {
    const v = n[key];
    out[key] = v == null ? null : v * factor;
  }
  return out;
}

function validate(input: AggregateRecipeInput): void {
  if (!(typeof input.servings === "number" && Number.isFinite(input.servings) && input.servings > 0)) {
    throw new RecipeInputError("servings", "Die Portionen müssen größer als 0 sein.");
  }
  if (input.totalWeightG != null) {
    if (!(Number.isFinite(input.totalWeightG) && input.totalWeightG > 0)) {
      throw new RecipeInputError("totalWeightG", "Das Gewicht nach dem Kochen muss größer als 0 g sein.");
    }
  }
  input.ingredients.forEach((ing, i) => {
    if (!(Number.isFinite(ing.grams) && ing.grams > 0)) {
      throw new RecipeInputError(`ingredients.${i}.grams`, "Die Menge muss größer als 0 sein.");
    }
    if (ing.densityGPerMl != null && !(Number.isFinite(ing.densityGPerMl) && ing.densityGPerMl > 0)) {
      throw new RecipeInputError(`ingredients.${i}.densityGPerMl`, "Ungültige Dichte.");
    }
    const p = ing.per100;
    for (const key of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
      if (!isNonNegative(p[key])) {
        throw new RecipeInputError(`ingredients.${i}.${key}`, "Ungültige Nährwerte bei einer Zutat.");
      }
    }
    for (const key of OPTIONAL_RECIPE_NUTRIENTS) {
      const v = p[key];
      if (v != null && !isNonNegative(v)) {
        throw new RecipeInputError(`ingredients.${i}.${key}`, "Ungültige Nährwerte bei einer Zutat.");
      }
    }
  });
}

/** Weight contribution of one ingredient in g (ml × density for liquids). */
export function ingredientWeightG(
  ing: Pick<RecipeIngredientNutritionInput, "grams" | "basis" | "densityGPerMl">,
) {
  return ing.basis === "ml" ? ing.grams * (ing.densityGPerMl ?? 1) : ing.grams;
}

/** Smallest dish weight (g) that keeps the per-100 g values within the foods-table limits. */
export function minPlausibleWeightG(totals: RecipeNutrients): number {
  const singles = [
    totals.proteinG,
    totals.carbsG,
    totals.fatG,
    totals.fiberG ?? 0,
    totals.sugarG ?? 0,
    totals.saturatedFatG ?? 0,
    totals.saltG ?? 0,
  ];
  return Math.max(
    (totals.kcal * 100) / PER100_LIMITS.kcal,
    (Math.max(...singles) * 100) / PER100_LIMITS.singleNutrientG,
    ((totals.proteinG + totals.carbsG + totals.fatG) * 100) / PER100_LIMITS.macroSumG,
  );
}

/**
 * Aggregates ingredient nutrients into totals, per-portion and per-100 g values.
 * Throws `RecipeInputError` for invalid input. An empty ingredient list yields zeros
 * (useful for a live summary while building); services require at least one ingredient.
 * No rounding: round only for display.
 */
export function aggregateRecipe(input: AggregateRecipeInput): RecipeAggregate {
  validate(input);

  const totals = zeroNutrients();
  const known: Record<OptionalRecipeNutrient, number> = Object.fromEntries(
    OPTIONAL_RECIPE_NUTRIENTS.map((k) => [k, 0]),
  ) as Record<OptionalRecipeNutrient, number>;
  let rawWeightG = 0;

  for (const ing of input.ingredients) {
    const f = ing.grams / 100;
    const p = ing.per100;
    totals.kcal += p.kcal * f;
    totals.proteinG += p.proteinG * f;
    totals.carbsG += p.carbsG * f;
    totals.fatG += p.fatG * f;
    for (const key of OPTIONAL_RECIPE_NUTRIENTS) {
      const v = p[key];
      if (v == null) continue;
      totals[key] = (totals[key] ?? 0) + v * f;
      known[key] += 1;
    }
    rawWeightG += ingredientWeightG(ing);
  }

  const count = input.ingredients.length;
  const incomplete = OPTIONAL_RECIPE_NUTRIENTS.filter((k) => known[k] > 0 && known[k] < count);

  const hasCookedWeight = input.totalWeightG != null;
  const totalWeightG = input.totalWeightG ?? rawWeightG;
  const perServing = scaleNutrients(totals, 1 / input.servings);
  const per100g = totalWeightG > 0 ? scaleNutrients(totals, 100 / totalWeightG) : scaleNutrients(totals, 0);

  return {
    totals,
    perServing,
    per100g,
    totalWeightG,
    rawWeightG,
    servingGrams: totalWeightG / input.servings,
    hasCookedWeight,
    minTotalWeightG: minPlausibleWeightG(totals),
    incomplete,
  };
}

/**
 * Energy share of protein / carbs / fat (4/4/9 kcal per g) as ratios that sum to 1,
 * or all 0 when there are no macros. For macro split bars.
 */
export function macroEnergySplit(n: Pick<RecipeNutrients, "proteinG" | "carbsG" | "fatG">) {
  const protein = n.proteinG * 4;
  const carbs = n.carbsG * 4;
  const fat = n.fatG * 9;
  const sum = protein + carbs + fat;
  if (!(sum > 0)) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: protein / sum, carbs: carbs / sum, fat: fat / sum };
}
