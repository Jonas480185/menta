import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatNumber } from "./number-utils";
import { toneSoftBg, toneText, type Tone } from "./tokens";

export interface StatDelta {
  /** Signed change, e.g. -0.4 (kg). */
  value: number;
  unit?: string;
  decimals?: number;
  /** Which direction is desirable. `none` renders the delta neutrally. Default `up`. */
  goodDirection?: "up" | "down" | "none";
  /** Context, e.g. "vs. Vorwoche". */
  label?: string;
}

export interface StatTileProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** Numbers are formatted de-DE; `null` renders an en dash (no data yet). */
  value: number | string | null;
  unit?: string;
  decimals?: number;
  delta?: StatDelta;
  icon?: React.ReactNode;
  tone?: Tone;
  /** Extra line below the value (e.g. "Ziel 72 kg"). */
  hint?: React.ReactNode;
  size?: "sm" | "md";
}

/** Compact KPI tile with a big tabular value – numbers are the hero. */
function StatTile({
  label,
  value,
  unit,
  decimals = 0,
  delta,
  icon,
  tone = "primary",
  hint,
  size = "md",
  className,
  ...props
}: StatTileProps) {
  const display = value === null ? "–" : typeof value === "number" ? formatNumber(value, { decimals }) : value;

  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 text-card-foreground shadow-sm shadow-foreground/5 dark:border-border dark:shadow-none",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md [&_svg:not([class*='size-'])]:size-4",
              toneSoftBg[tone],
              tone === "primary" || tone === "muted" ? "text-foreground" : toneText[tone],
            )}
          >
            {icon}
          </span>
        )}
        <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="flex items-baseline gap-1">
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground tabular-nums",
            size === "md" ? "text-3xl leading-none" : "text-2xl leading-none",
          )}
        >
          {display}
        </span>
        {unit && value !== null && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {delta && <DeltaIndicator {...delta} />}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Signed change with arrow. Good = success colour, otherwise neutral (never alarming red). */
function DeltaIndicator({ value, unit, decimals = 1, goodDirection = "up", label }: StatDelta) {
  const rounded = Number(value.toFixed(decimals));
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const isGood = goodDirection !== "none" && direction !== "flat" && direction === goodDirection;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "±";
  const text = `${sign}${formatNumber(Math.abs(rounded), { decimals })}${unit ? ` ${unit}` : ""}`;

  return (
    <p className="flex items-center gap-1 text-xs font-medium">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 tabular-nums",
          isGood ? "bg-success/15 text-foreground [&_svg]:text-success" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {text}
      </span>
      {label && <span className="text-muted-foreground">{label}</span>}
    </p>
  );
}

export { DeltaIndicator, StatTile };
