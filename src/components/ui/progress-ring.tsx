"use client";

import { motion, useTransform } from "motion/react";

import { cn } from "@/lib/utils";

import {
  clamp,
  computeProgress,
  dashOffset,
  describeProgress,
  ringGeometry,
  sanitize,
} from "./progress-math";
import { toneGraphic, type Tone } from "./tokens";
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
  /**
   * Geometry in px (default 120). The ring renders at this size but scales with CSS, so
   * responsive sizes work via className, e.g. `size={176} className="md:size-50"`.
   */
  size?: number;
  /** Stroke width in px (default ≈ 10 % of size, min 4). */
  strokeWidth?: number;
  /** Colour token of the progress arc (default "kcal"). */
  tone?: Tone;
  /** `track` = neutral `--track` (default), `soft` = the tone at low opacity. */
  track?: "track" | "soft";
  /** Animate with `spring.ring` on mount / update (default true; off for reduced motion). */
  animate?: boolean;
  /** Content centred inside the ring (value, label, icon). */
  children?: React.ReactNode;
}

/**
 * Circular progress (SVG, starts at 12 o'clock, round caps). Past 100 % the arc stays
 * complete in its tone and a slightly thinner second lap in `over` grows on top after a
 * 2° gap (capped at one extra lap): visible by shape and colour, never alarming.
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
  track = "track",
  animate = true,
  children,
  className,
  style,
  ...props
}: ProgressRingProps) {
  const stroke = strokeWidth ?? Math.max(4, Math.round(size * 0.1));
  const overStroke = Math.max(2, stroke - 2);
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
      className={cn(
        "relative inline-flex size-(--ring-size) shrink-0 items-center justify-center",
        className,
      )}
      style={{ "--ring-size": `${size}px`, ...style } as React.CSSProperties}
      {...props}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 size-full -rotate-90"
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
          className={track === "track" ? "text-track" : toneGraphic[tone]}
          strokeOpacity={track === "track" ? 1 : 0.18}
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
          className={toneGraphic[tone]}
          style={{ strokeDashoffset: fillOffset, opacity: fillOpacity }}
        />
        {progress.isOver && (
          <motion.circle
            data-slot="progress-ring-over"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={overStroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            transform={`rotate(2 ${center} ${center})`}
            className="text-over"
            style={{ strokeDashoffset: overOffset, opacity: overOpacity }}
          />
        )}
      </svg>
      {children != null && (
        <div className="relative flex flex-col items-center justify-center text-center leading-none">
          {children}
        </div>
      )}
    </div>
  );
}

export { ProgressRing };
