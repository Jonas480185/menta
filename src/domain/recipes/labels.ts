import { formatNumber, NBSP } from "@/lib/format";

/** "1 Portion (≈ 363 g)": label of the default serving of a recipe's linked food. */
export function recipePortionLabel(servingGrams: number): string {
  const g = servingGrams >= 10 ? Math.round(servingGrams) : Math.round(servingGrams * 10) / 10;
  return `1 Portion (≈${NBSP}${formatNumber(g, { maxFractionDigits: 1 })}${NBSP}g)`;
}

/** "4 Portionen" / "1 Portion" / "2,5 Portionen". */
export function formatPortions(servings: number): string {
  const n = formatNumber(servings, { maxFractionDigits: 2 });
  return `${n}${NBSP}${servings === 1 ? "Portion" : "Portionen"}`;
}
