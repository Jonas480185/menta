"use client";

import { cn } from "@/lib/utils";

import { formatNumber, NBSP } from "@/lib/format";

import { ProgressRing } from "./progress-ring";
import { nutrientLabel, type Tone } from "./tokens";

export interface MacroValue {
  consumed: number;
  target: number;
}

export interface MacroRingsProps extends Omit<React.ComponentProps<"div">, "children"> {
  protein: MacroValue;
  carbs: MacroValue;
  fat: MacroValue;
  /** Ring diameter in px (default 80). */
  size?: number;
  animate?: boolean;
}

const MACROS = [
  { key: "protein", tone: "protein" },
  { key: "carbs", tone: "carbs" },
  { key: "fat", tone: "fat" },
] as const satisfies ReadonlyArray<{ key: "protein" | "carbs" | "fat"; tone: Tone }>;

/** Compact trio of macro rings in the fixed order Protein → Kohlenhydrate → Fett, grams inside. */
function MacroRings({
  protein,
  carbs,
  fat,
  size = 80,
  animate = true,
  className,
  ...props
}: MacroRingsProps) {
  const values = { protein, carbs, fat };
  return (
    <div data-slot="macro-rings" className={cn("grid grid-cols-3 gap-2", className)} {...props}>
      {MACROS.map(({ key, tone }) => {
        const v = values[key];
        return (
          <div key={key} className="flex flex-col items-center gap-2">
            <ProgressRing
              value={v.consumed}
              max={v.target}
              label={nutrientLabel[key]}
              unit="g"
              tone={tone}
              size={size}
              animate={animate}
            >
              <span className="numeric text-stat-sm text-foreground">{formatNumber(v.consumed)}</span>
              <span className="mt-0.5 text-caption text-muted-foreground">g</span>
            </ProgressRing>
            <div className="flex flex-col items-center gap-0.5 text-center" aria-hidden="true">
              <span className="text-caption text-foreground">{nutrientLabel[key]}</span>
              <span className="text-caption text-muted-foreground tabular">
                von {formatNumber(v.target)}
                {NBSP}g
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { MacroRings };
