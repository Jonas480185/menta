"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Flame, Utensils } from "lucide-react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { computeProgress, describeProgress, sanitize } from "@/components/ui/progress-math";
import { toneFill, type Tone } from "@/components/ui/tokens";
import { useProgressSpring } from "@/components/ui/use-progress-spring";
import { formatNumber, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DailyOverviewProps {
  consumedKcal: number;
  targetKcal: number;
  /** Activity kcal that extend the budget (only when the user counts them). */
  budgetActivityKcal: number;
  /** Burned activity kcal to display (always shown, even if not added to the budget). */
  burnedKcal: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
  macroTargets: { proteinG: number; carbsG: number; fatG: number };
  /** Link for the whole card (e.g. today's diary). */
  href: string;
}

/**
 * Today hero, modelled on the summary card of Yazio / Lose It: eaten · ring with what's left ·
 * burned, then three compact macro columns. One big number, everything else secondary.
 */
export function DailyOverview({
  consumedKcal,
  targetKcal,
  budgetActivityKcal,
  burnedKcal,
  macros,
  macroTargets,
  href,
}: DailyOverviewProps) {
  const eaten = sanitize(consumedKcal);
  const budget = sanitize(targetKcal) + sanitize(budgetActivityKcal);
  const p = computeProgress(eaten, budget);
  const hero = p.isOver ? p.overAmount : p.remaining;

  return (
    <section aria-label="Kalorien und Makros" className="rounded-card bg-card p-card shadow-xs">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <SideStat icon={<Utensils className="size-4" />} value={eaten} label="Gegessen" tone="text-kcal-strong" />
        <Link href={href} aria-label="Zum Tagebuch von heute" className="focus-ring rounded-full">
          <ProgressRing
            value={eaten}
            max={budget}
            label="Kalorien"
            unit="kcal"
            tone="kcal"
            size={156}
            className="md:size-44 lg:size-56"
            valueText={describeProgress(eaten, budget, { unit: "kcal" })}
          >
            <motion.span
              key={hero}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("numeric text-stat lg:text-display", p.isOver ? "text-over-strong" : "text-foreground")}
            >
              {formatNumber(hero)}
            </motion.span>
            <span className={cn("mt-1 text-caption", p.isOver ? "text-over-strong" : "text-muted-foreground")}>
              {p.isOver ? "kcal drüber" : "kcal übrig"}
            </span>
          </ProgressRing>
        </Link>
        <SideStat icon={<Flame className="size-4" />} value={burnedKcal} label="Aktivität" tone="text-activity-strong" />
      </div>

      <p className="mt-2 text-center text-caption text-muted-foreground tabular">
        Ziel {formatNumber(budget)}
        {NBSP}kcal{budgetActivityKcal > 0 ? ` (inkl. ${formatNumber(budgetActivityKcal)} Aktivität)` : ""}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <MacroColumn label="Kohlenhydrate" value={macros.carbsG} target={macroTargets.carbsG} tone="carbs" />
        <MacroColumn label="Protein" value={macros.proteinG} target={macroTargets.proteinG} tone="protein" />
        <MacroColumn label="Fett" value={macros.fatG} target={macroTargets.fatG} tone="fat" />
      </div>
    </section>
  );
}

function SideStat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className={cn("flex size-8 items-center justify-center rounded-full bg-surface-inset", tone)} aria-hidden>
        {icon}
      </span>
      <span className="numeric text-stat-sm lg:text-stat">{formatNumber(value)}</span>
      <span className="text-caption text-muted-foreground">{label}</span>
    </div>
  );
}

function MacroColumn({ label, value, target, tone }: { label: string; value: number; target: number; tone: Tone }) {
  const progress = computeProgress(value, target);
  const scaleX = useProgressSpring(progress.fill);
  return (
    <div className="min-w-0 text-center">
      <div className="truncate text-caption font-medium text-foreground lg:text-body-sm">{label}</div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(sanitize(target))}
        aria-valuenow={Math.round(Math.min(sanitize(value), sanitize(target)))}
        aria-valuetext={describeProgress(value, target, { unit: "g" })}
        className="relative mx-auto mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-track lg:h-2"
      >
        <motion.div className={cn("absolute inset-0 origin-left rounded-full", progress.isOver ? "bg-over" : toneFill[tone])} style={{ scaleX }} />
      </div>
      <div className="mt-1.5 text-caption text-muted-foreground tabular">
        <span className="font-semibold text-foreground">{formatNumber(value)}</span> / {formatNumber(target)}
        {NBSP}g
      </div>
    </div>
  );
}
