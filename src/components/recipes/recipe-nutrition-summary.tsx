import type { RecipeAggregate } from "@/domain/recipes";
import { formatGrams, formatKcal, formatNumber, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MacroSplit } from "./macro-split";

export interface RecipeNutritionSummaryProps {
  nutrition: RecipeAggregate;
  servings: number;
  /** "live" = compact heading for the builder, "detail" = large hero numbers. */
  variant?: "live" | "detail";
  className?: string;
}

/**
 * Per-portion hero (kcal + macro split) and the secondary facts: whole recipe, per 100 g and
 * grams per portion. Pure presentational: values come from aggregateRecipe().
 */
export function RecipeNutritionSummary({
  nutrition,
  servings,
  variant = "detail",
  className,
}: RecipeNutritionSummaryProps) {
  const { perServing, totals, per100g, servingGrams, hasCookedWeight } = nutrition;
  const hero = variant === "detail" ? "text-display" : "text-stat";

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-1">
        <p className="text-body-sm font-medium text-muted-foreground">Pro Portion</p>
        <p className="flex items-baseline gap-1.5 text-foreground">
          <span className={cn(hero, "tabular")}>{formatNumber(perServing.kcal)}</span>
          <span className="text-body font-medium text-muted-foreground">kcal</span>
        </p>
      </div>

      <MacroSplit proteinG={perServing.proteinG} carbsG={perServing.carbsG} fatG={perServing.fatG} />

      <dl className="grid grid-cols-3 gap-2 rounded-card bg-surface-inset p-3">
        <Fact label="Gesamt" value={formatKcal(totals.kcal)} />
        <Fact label="Pro 100 g" value={formatKcal(per100g.kcal)} />
        <Fact
          label="Portion"
          value={servingGrams > 0 ? `≈${NBSP}${formatGrams(servingGrams)}` : "–"}
          hint={
            servings > 0
              ? `${formatNumber(servings, { maxFractionDigits: 2 })} ${servings === 1 ? "Portion" : "Portionen"}${hasCookedWeight ? " · gekocht" : ""}`
              : undefined
          }
        />
      </dl>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="truncate text-body-sm font-semibold text-foreground tabular">{value}</dd>
      {hint && <dd className="truncate text-caption text-muted-foreground">{hint}</dd>}
    </div>
  );
}
