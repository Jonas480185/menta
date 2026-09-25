"use client";

import { motion, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

import { formatNumber } from "./number-utils";
import { barSegments, clamp, computeProgress, describeProgress, sanitize } from "./progress-math";
import { toneBg, toneText, type Tone } from "./tokens";
import { useProgressSpring } from "./use-progress-spring";

export interface MacroBarProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: string;
  consumed: number;
  target: number;
  /** Default "g". */
  unit?: string;
  tone?: Tone;
  decimals?: number;
  /** Show "58 g übrig" / "20 g über dem Ziel" below the bar (default true). */
  showRemaining?: boolean;
  size?: "sm" | "md";
  animate?: boolean;
}

/**
 * Linear macro progress: label, "consumed / target unit", bar and remaining text.
 * Over target the bar rescales: the tone segment ends at the target and the surplus is
 * a separate `over` segment after a small gap.
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
  const segments = barSegments(consumed, target);
  const hasTarget = sanitize(target) > 0;
  const fmt = (n: number) => formatNumber(n, { decimals });

  const base = useProgressSpring(segments.basePct, animate);
  const over = useProgressSpring(segments.overPct, animate);
  const baseClip = useTransform(base, (b) => `inset(0 ${100 - clamp(b, 0, 100)}% 0 0 round 9999px)`);
  const overClip = useTransform([base, over], ([b, o]: number[]) => {
    const start = clamp(b, 0, 100);
    const end = clamp(b + o, 0, 100);
    return `inset(0 ${100 - end}% 0 calc(${start}% + 3px) round 9999px)`;
  });

  return (
    <div data-slot="macro-bar" data-over={progress.isOver || undefined} className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("flex items-center gap-2 font-medium text-foreground", size === "md" ? "text-sm" : "text-xs")}>
          <span aria-hidden="true" className={cn("size-2 rounded-full", toneBg[tone])} />
          {label}
        </span>
        <span className={cn("text-muted-foreground tabular-nums", size === "md" ? "text-sm" : "text-xs")}>
          <span className="font-semibold text-foreground">{fmt(sanitize(consumed))}</span>
          {hasTarget && <> / {fmt(sanitize(target))}</>}
          {unit && ` ${unit}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={sanitize(target)}
        aria-valuenow={Math.round(clamp(sanitize(consumed), 0, sanitize(target)))}
        aria-valuetext={describeProgress(consumed, target, { unit, decimals })}
        className={cn("relative w-full overflow-hidden rounded-full", size === "md" ? "h-2.5" : "h-1.5")}
      >
        <div aria-hidden="true" className={cn("absolute inset-0 opacity-16", toneBg[tone])} />
        <motion.div aria-hidden="true" className={cn("absolute inset-0", toneBg[tone])} style={{ clipPath: baseClip }} />
        {progress.isOver && (
          <motion.div aria-hidden="true" className="absolute inset-0 bg-over" style={{ clipPath: overClip }} />
        )}
      </div>
      {showRemaining && hasTarget && (
        <p className={cn("text-muted-foreground tabular-nums", size === "md" ? "text-xs" : "text-[11px]")}>
          {progress.isOver ? (
            <>
              <span className={cn("font-medium", toneText.over)}>
                {fmt(progress.overAmount)}
                {unit && ` ${unit}`}
              </span>{" "}
              über dem Ziel
            </>
          ) : progress.remaining === 0 ? (
            "Ziel erreicht"
          ) : (
            <>
              {fmt(progress.remaining)}
              {unit && ` ${unit}`} übrig
            </>
          )}
        </p>
      )}
    </div>
  );
}

export { MacroBar };
