"use client";

import { motion, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

import { clamp, computeProgress, dashOffset, describeProgress, ringGeometry, sanitize } from "./progress-math";
import { toneText, type Tone } from "./tokens";
import { useProgressSpring } from "./use-progress-spring";

export interface ProgressRingProps extends Omit<React.ComponentProps<"div">, "children"> {
  value: number;
  max: number;
  /** Accessible name, e.g. "Kalorien". */
  label: string;
  /** Unit for the generated `aria-valuetext` ("kcal", "g"). */
  unit?: string;
  /** Override the generated `aria-valuetext`. */
  valueText?: string;
  /** Diameter in px (default 120). */
  size?: number;
  /** Stroke width in px (default ≈ 9 % of size, min 4). */
  strokeWidth?: number;
  /** Colour token of the progress arc (default "kcal"). */
  tone?: Tone;
  /** Track style: tinted with the tone (default) or neutral muted. */
  track?: "tone" | "muted";
  /** Animate with a spring on mount / update (default true; always off for reduced motion). */
  animate?: boolean;
  /** Content centred inside the ring (value, label, icon). */
  children?: React.ReactNode;
}

/**
 * Circular progress. Past 100 % the ring stays full in its tone and a second lap in the
 * `over` colour grows on top (capped at one extra lap), so "over target" is visible
 * without alarming red fills.
 */
function ProgressRing({
  value,
  max,
  label,
  unit,
  valueText,
  size = 120,
  strokeWidth,
  tone = "kcal",
  track = "tone",
  animate = true,
  children,
  className,
  style,
  ...props
}: ProgressRingProps) {
  const stroke = strokeWidth ?? Math.max(4, Math.round(size * 0.09));
  const { center, radius, circumference } = ringGeometry(size, stroke);
  const progress = computeProgress(value, max);

  const fill = useProgressSpring(progress.fill, animate);
  const overflow = useProgressSpring(progress.overflow, animate);
  const fillOffset = useTransform(fill, (f) => dashOffset(circumference, f));
  const fillOpacity = useTransform(fill, (f) => (f > 0.002 ? 1 : 0));
  const overOffset = useTransform(overflow, (f) => dashOffset(circumference, f));
  const overOpacity = useTransform(overflow, (f) => (f > 0.002 ? 1 : 0));

  const safeMax = sanitize(max);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round(clamp(sanitize(value), 0, safeMax))}
      aria-valuetext={valueText ?? describeProgress(value, max, { unit })}
      data-slot="progress-ring"
      data-over={progress.isOver || undefined}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className={track === "tone" ? toneText[tone] : "text-muted"}
          strokeOpacity={track === "tone" ? 0.16 : 1}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={toneText[tone]}
          style={{ strokeDashoffset: fillOffset, opacity: fillOpacity }}
        />
        {progress.isOver && (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            className="text-over"
            style={{ strokeDashoffset: overOffset, opacity: overOpacity }}
          />
        )}
      </svg>
      {children != null && (
        <div className="relative flex flex-col items-center justify-center text-center leading-none">{children}</div>
      )}
    </div>
  );
}

export { ProgressRing };
