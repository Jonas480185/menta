"use client";

import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { spring, type NutrientKey } from "@/components/theme/tokens";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("de-DE");

/** Sample values: styleguide only, never shown in product UI. */
const KCAL = { eaten: 1620, goal: 2300 };
const MACROS: Array<{ key: NutrientKey; label: string; value: number; goal: number }> = [
  { key: "protein", label: "Protein", value: 92, goal: 140 },
  { key: "carbs", label: "Kohlenhydrate", value: 180, goal: 250 },
  { key: "fat", label: "Fett", value: 71, goal: 65 },
];

const FILL: Record<NutrientKey, string> = {
  kcal: "bg-kcal",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
  fiber: "bg-fiber",
  water: "bg-water",
  weight: "bg-weight",
  activity: "bg-activity",
  over: "bg-over",
};

/** Literal class names so Tailwind can see them. */
const CHIP: Array<[label: string, className: string]> = [
  ["Protein", "bg-protein-soft text-protein-strong"],
  ["Kohlenhydrate", "bg-carbs-soft text-carbs-strong"],
  ["Fett", "bg-fat-soft text-fat-strong"],
  ["Ballaststoffe", "bg-fiber-soft text-fiber-strong"],
  ["Wasser", "bg-water-soft text-water-strong"],
  ["Gewicht", "bg-weight-soft text-weight-strong"],
  ["Aktivität", "bg-activity-soft text-activity-strong"],
  ["Über Ziel", "bg-over-soft text-over-strong"],
  ["Mint", "bg-primary-soft text-primary-strong"],
];

export function NutritionDemo() {
  const [run, setRun] = useState(0);
  const progress = KCAL.eaten / KCAL.goal;
  const remaining = KCAL.goal - KCAL.eaten;

  return (
    <div className="bg-card text-card-foreground rounded-card p-card grid gap-6 shadow-sm md:grid-cols-[auto_1fr] dark:border">
      <div className="flex flex-col items-center gap-3">
        <div className="relative size-44" key={run}>
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="44" fill="none" strokeWidth="9" className="stroke-track" />
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              className="stroke-kcal"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progress }}
              transition={spring.ring}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-display numeric">{fmt.format(remaining)}</span>
            <span className="text-muted-foreground text-caption">kcal übrig</span>
          </div>
        </div>
        <p className="text-muted-foreground text-body-sm numeric">
          {fmt.format(KCAL.eaten)} gegessen · {fmt.format(KCAL.goal)} Ziel
        </p>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="text-primary-strong hover:bg-primary-soft inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-body-sm font-medium transition-colors"
        >
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
          Animation wiederholen
        </button>
      </div>

      <div className="flex flex-col justify-center gap-5">
        {MACROS.map(({ key, label, value, goal }) => {
          const over = value - goal;
          const pct = Math.min(value / goal, 1);
          return (
            <div key={key} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body-sm flex items-center gap-2 font-medium">
                  <span aria-hidden className={cn("size-2 rounded-full", FILL[key])} />
                  {label}
                </span>
                <span className="text-body-sm numeric">
                  <span className="font-semibold">{fmt.format(value)}</span>
                  <span className="text-muted-foreground"> / {fmt.format(goal)} g</span>
                </span>
              </div>
              <div className="bg-track relative h-2 overflow-hidden rounded-full">
                <motion.div
                  key={run}
                  className={cn("h-full w-full origin-left rounded-full", FILL[key])}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct }}
                  transition={spring.ring}
                />
                {over > 0 && (
                  <span
                    aria-hidden
                    className="bg-over ring-card absolute inset-y-0 right-0 w-3 rounded-full ring-2"
                  />
                )}
              </div>
              {over > 0 && (
                <span className="text-over-strong text-caption">
                  {fmt.format(over)} g über Ziel
                </span>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {CHIP.map(([label, className]) => (
            <span key={label} className={cn("text-caption rounded-sm px-2.5 py-1", className)}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
