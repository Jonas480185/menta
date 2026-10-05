import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatNumber, NBSP } from "@/lib/format";

import { cardSurface, toneSoft, toneStrong, type Tone } from "./tokens";

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

/** Compact KPI tile with a big tabular value: numbers are the hero. */
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
  const display =
    value === null
      ? "–"
      : typeof value === "number"
        ? formatNumber(value, { maxFractionDigits: decimals, minFractionDigits: decimals })
        : value;

  return (
    <div
      data-slot="stat-tile"
      className={cn(cardSurface, "flex min-w-0 flex-col gap-2 p-4", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-sm [&_svg:not([class*='size-'])]:size-4",
              toneSoft[tone],
              toneStrong[tone],
            )}
          >
            {icon}
          </span>
        )}
        <span className="truncate text-body-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="flex items-baseline gap-1">
        <span className={cn("numeric text-foreground", size === "md" ? "text-stat" : "text-stat-sm")}>
          {display}
        </span>
        {unit && value !== null && <span className="text-body-sm text-muted-foreground">{unit}</span>}
      </p>
      {delta && <DeltaIndicator {...delta} />}
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Signed change with arrow. Good = success colour, otherwise neutral (never alarming red). */
function DeltaIndicator({ value, unit, decimals = 1, goodDirection = "up", label }: StatDelta) {
  const rounded = Number(value.toFixed(decimals));
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const isGood = goodDirection !== "none" && direction !== "flat" && direction === goodDirection;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const text = `${formatNumber(rounded, { maxFractionDigits: decimals, signed: true })}${unit ? `${NBSP}${unit}` : ""}`;

  return (
    <p className="flex items-center gap-1.5 text-caption">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-xs px-1.5 py-0.5 tabular",
          isGood ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
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
