"use client";

import { motion } from "motion/react";

import { formatNumber, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";

import { clamp, computeProgress, describeProgress, sanitize } from "./progress-math";
import { toneFill, type Tone } from "./tokens";
import { useProgressSpring } from "./use-progress-spring";

export interface MacroBarProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: string;
  consumed: number;
  target: number;
  /** Default "g". */
  unit?: string;
  tone?: Tone;
  decimals?: number;
  /** Show "58 g übrig" / "6 g über Ziel" below the bar (default true). */
  showRemaining?: boolean;
  size?: "sm" | "md";
  animate?: boolean;
}

/**
 * Linear macro progress (docs/design/visual-language.md §2): dot + label, "92 / 140 g",
 * an 8 px track with a `scaleX` spring fill. Over target the fill stays at 100 % in the
 * macro colour, a 12 px `over` cap marks the end and "{n} g über Ziel" appears below.
 */
function MacroBar({
  label,
  consumed,
  target,
  unit = "g",
  tone = "protein",
  decimals = 0,
  showRemaining = true,
  size = "md",
  animate = true,
  className,
  ...props
}: MacroBarProps) {
  const progress = computeProgress(consumed, target);
  const hasTarget = sanitize(target) > 0;
  const fmt = (n: number) => formatNumber(n, { maxFractionDigits: decimals });
  const withUnit = (n: number) => (unit ? `${fmt(n)}${NBSP}${unit}` : fmt(n));
  const scaleX = useProgressSpring(progress.fill, animate);

  return (
    <div
      data-slot="macro-bar"
      data-over={progress.isOver || undefined}
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "flex items-center gap-2 font-medium text-foreground",
            size === "md" ? "text-body-sm" : "text-caption",
          )}
        >
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", toneFill[tone])} />
          {label}
        </span>
        <span
          className={cn("text-muted-foreground tabular", size === "md" ? "text-body-sm" : "text-caption")}
        >
          <span className="numeric font-semibold text-foreground">{fmt(sanitize(consumed))}</span>
          {hasTarget ? ` / ${withUnit(sanitize(target))}` : unit ? `${NBSP}${unit}` : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={sanitize(target)}
        aria-valuenow={Math.round(clamp(sanitize(consumed), 0, sanitize(target)))}
        aria-valuetext={describeProgress(consumed, target, { unit, decimals })}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-track",
          size === "md" ? "h-2" : "h-1.5",
        )}
      >
        <motion.div
          aria-hidden="true"
          className={cn("absolute inset-0 origin-left rounded-full", toneFill[tone])}
          style={{ scaleX }}
        />
        {progress.isOver && (
          <span
            data-slot="macro-bar-over"
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-3 rounded-full bg-over ring-2 ring-card"
          />
        )}
      </div>
      {showRemaining && hasTarget && (
        <p className="text-caption tabular">
          {progress.isOver ? (
            <span className="text-over-strong">{withUnit(progress.overAmount)} über Ziel</span>
          ) : progress.remaining === 0 ? (
            <span className="text-muted-foreground">Ziel erreicht</span>
          ) : (
            <span className="text-muted-foreground">{withUnit(progress.remaining)} übrig</span>
          )}
        </p>
      )}
    </div>
  );
}

export { MacroBar };
