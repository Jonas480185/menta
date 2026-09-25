"use client";

import { cn } from "@/lib/utils";

import { formatNumber } from "./number-utils";
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
  /** Ring diameter in px (default 76). */
  size?: number;
  animate?: boolean;
}

const MACROS = [
  { key: "protein", tone: "protein" },
  { key: "carbs", tone: "carbs" },
  { key: "fat", tone: "fat" },
] as const satisfies ReadonlyArray<{ key: "protein" | "carbs" | "fat"; tone: Tone }>;

/** Compact trio of macro rings (Protein · Kohlenhydrate · Fett) with grams inside. */
function MacroRings({ protein, carbs, fat, size = 76, animate = true, className, ...props }: MacroRingsProps) {
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
              <span className="text-base font-semibold text-foreground tabular-nums">{formatNumber(v.consumed)}</span>
              <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">g</span>
            </ProgressRing>
            <div className="flex flex-col items-center gap-0.5 text-center" aria-hidden="true">
              <span className="text-xs font-medium text-foreground">{nutrientLabel[key]}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">von {formatNumber(v.target)}&#8239;g</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { MacroRings };
