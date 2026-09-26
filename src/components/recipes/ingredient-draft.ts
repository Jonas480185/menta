import type { IngredientFoodOption, IngredientServingOption } from "@/server/services/recipes";
import { formatNumber, NBSP } from "@/lib/format";

/** An ingredient while editing a recipe (client state). `servingId: null` → quantity in g/ml. */
export interface IngredientDraft {
  key: string;
  food: IngredientFoodOption;
  servingId: string | null;
  quantity: number;
}

/** The "100 g"/"100 ml" base serving is redundant with entering grams directly. */
export function isBaseServing(food: IngredientFoodOption, s: IngredientServingOption) {
  return s.grams === 100 && /^100\s*(g|ml)$/i.test(s.label.trim());
}

/** Servings offered in the picker (without the 100-unit base serving). */
export function pickableServings(food: IngredientFoodOption) {
  return food.servings.filter((s) => !isBaseServing(food, s));
}

/** Sensible starting amount for a freshly picked food. */
export function defaultAmount(food: IngredientFoodOption): { servingId: string | null; quantity: number } {
  const servings = pickableServings(food);
  const preferred = servings.find((s) => s.isDefault) ?? null;
  return preferred ? { servingId: preferred.id, quantity: 1 } : { servingId: null, quantity: 100 };
}

/** Base units (g/ml) of an ingredient draft. */
export function draftGrams(d: Pick<IngredientDraft, "food" | "servingId" | "quantity">): number {
  if (!d.servingId) return d.quantity;
  const s = d.food.servings.find((x) => x.id === d.servingId);
  return s ? s.grams * d.quantity : d.quantity;
}

/** "250 g" or "2 × 1 Scheibe · 60 g". */
export function draftAmountLabel(d: Pick<IngredientDraft, "food" | "servingId" | "quantity">): string {
  const grams = draftGrams(d);
  const g = `${formatNumber(grams, { maxFractionDigits: grams < 10 ? 1 : 0 })}${NBSP}${d.food.basis}`;
  const s = d.servingId ? d.food.servings.find((x) => x.id === d.servingId) : undefined;
  if (!s) return g;
  return `${formatNumber(d.quantity, { maxFractionDigits: 2 })} × ${s.label} · ${g}`;
}

/** kcal of an ingredient draft. */
export function draftKcal(d: Pick<IngredientDraft, "food" | "servingId" | "quantity">): number {
  return (d.food.per100.kcal * draftGrams(d)) / 100;
}

let seq = 0;
export const newDraftKey = () => `ing-${Date.now().toString(36)}-${++seq}`;
