import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { nutrientLabel, toneFill, toneSoft, toneStrong } from "./tokens";

type Nutrient = keyof typeof nutrientLabel;

const SHORT: Record<Nutrient, string> = {
  kcal: "kcal",
  protein: "P",
  carbs: "K",
  fat: "F",
  fiber: "B",
  water: "W",
};
const DEFAULT_UNIT: Record<Nutrient, string> = {
  kcal: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fiber: "g",
  water: "ml",
};

export interface NutritionBadgeProps extends Omit<React.ComponentProps<"span">, "children"> {
  nutrient: Nutrient;
  value: number;
  unit?: string;
  decimals?: number;
  /** `soft` = tinted chip "P 32 g" (meal cards, food detail), `plain` = dot + text (dense rows). */
  variant?: "soft" | "plain";
}

/** One nutrient value, e.g. "P 12 g". The full nutrient name is exposed to screen readers. */
function NutritionBadge({
  nutrient,
  value,
  unit,
  decimals = 0,
  variant = "plain",
  className,
  ...props
}: NutritionBadgeProps) {
  const u = unit ?? DEFAULT_UNIT[nutrient];
  const isKcal = nutrient === "kcal";
  const soft = variant === "soft";
  return (
    <span
      data-slot="nutrition-badge"
      className={cn(
        "inline-flex items-center gap-1 text-caption whitespace-nowrap tabular",
        soft
          ? cn("rounded-sm px-2.5 py-1", toneSoft[nutrient], toneStrong[nutrient])
          : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {!isKcal && !soft && (
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", toneFill[nutrient])} />
      )}
      {!isKcal && (
        <>
          <span aria-hidden="true">{SHORT[nutrient]}</span>
          <span className="sr-only">{nutrientLabel[nutrient]}</span>
        </>
      )}
      <span className={cn("font-semibold", !soft && "text-foreground")}>
        {formatNumber(value, { maxFractionDigits: decimals })}
      </span>
      <span>{u}</span>
    </span>
  );
}

export interface MacroChipsProps extends Omit<React.ComponentProps<"span">, "children"> {
  protein: number;
  carbs: number;
  fat: number;
  /** Optional energy shown first. */
  kcal?: number;
  decimals?: number;
  variant?: "soft" | "plain";
}

/** Compact P / K / F grams (fixed order) for list rows, meal cards and food details. */
function MacroChips({
  protein,
  carbs,
  fat,
  kcal,
  decimals = 0,
  variant = "plain",
  className,
  ...props
}: MacroChipsProps) {
  return (
    <span
      data-slot="macro-chips"
      className={cn(
        "inline-flex flex-wrap items-center",
        variant === "soft" ? "gap-1.5" : "gap-x-2.5 gap-y-1",
        className,
      )}
      {...props}
    >
      {kcal !== undefined && <NutritionBadge nutrient="kcal" value={kcal} variant={variant} />}
      <NutritionBadge nutrient="protein" value={protein} decimals={decimals} variant={variant} />
      <NutritionBadge nutrient="carbs" value={carbs} decimals={decimals} variant={variant} />
      <NutritionBadge nutrient="fat" value={fat} decimals={decimals} variant={variant} />
    </span>
  );
}

export { MacroChips, NutritionBadge };
