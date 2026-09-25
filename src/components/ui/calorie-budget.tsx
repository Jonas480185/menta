"use client";

import { formatNumber, NBSP } from "@/lib/format";
import { cn } from "@/lib/utils";

import { computeProgress, describeProgress, sanitize } from "./progress-math";
import { ProgressRing } from "./progress-ring";

export interface CalorieBudgetProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Eaten today (kcal). */
  consumed: number;
  /** Daily goal (kcal). */
  target: number;
  /** Activity calories that extend the budget (kcal, optional). */
  activity?: number;
  /** Replace the default ring (e.g. a custom visual). */
  children?: React.ReactNode;
  /** Ring geometry in px (default 176; grows to 200 px at ≥ md). */
  ringSize?: number;
  animate?: boolean;
}

/**
 * The Today hero (docs/design/visual-language.md §1): kcal ring with ONE big number –
 * remaining ("680 kcal übrig"), the goal when nothing is logged ("2.300 kcal Ziel") or
 * the surplus ("120 kcal drüber") – plus the equation Gegessen / Aktivität / Ziel.
 * Side by side from ≈ 360 px container width, stacked below.
 */
function CalorieBudget({
  consumed,
  target,
  activity = 0,
  children,
  ringSize = 176,
  animate = true,
  className,
  ...props
}: CalorieBudgetProps) {
  const eaten = sanitize(consumed);
  const act = sanitize(activity);
  const budget = sanitize(target) + act;
  const p = computeProgress(eaten, budget);
  const empty = eaten === 0;

  const hero = empty ? budget : p.isOver ? p.overAmount : p.remaining;
  const caption = empty ? "kcal Ziel" : p.isOver ? "kcal drüber" : "kcal übrig";

  return (
    <div data-slot="calorie-budget" className={cn("@container", className)} {...props}>
      <div className="flex flex-col items-center gap-5 @[22.5rem]:flex-row @[22.5rem]:justify-between">
        {children ?? (
          <ProgressRing
            value={eaten}
            max={budget}
            label="Kalorien"
            unit="kcal"
            tone="kcal"
            size={ringSize}
            animate={animate}
            className="md:size-50"
            valueText={describeProgress(eaten, budget, { unit: "kcal" })}
          >
            <span className={cn("numeric text-display", p.isOver ? "text-over-strong" : "text-foreground")}>
              {formatNumber(hero)}
            </span>
            <span
              className={cn("mt-1.5 text-caption", p.isOver ? "text-over-strong" : "text-muted-foreground")}
            >
              {caption}
            </span>
          </ProgressRing>
        )}
        <dl className="grid w-full max-w-64 grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2.5 @[22.5rem]:w-auto">
          <dt className="text-body-sm text-muted-foreground">Gegessen</dt>
          <dd className="text-right numeric text-stat-sm text-foreground">{formatNumber(eaten)}</dd>
          {act > 0 && (
            <>
              <dt className="text-body-sm text-muted-foreground">Aktivität</dt>
              <dd className="text-right numeric text-stat-sm text-activity-strong">
                {formatNumber(act, { signed: true })}
              </dd>
            </>
          )}
          <dt className="text-body-sm text-muted-foreground">Ziel</dt>
          <dd className="text-right numeric text-stat-sm text-foreground">
            {formatNumber(sanitize(target))}
            <span className="sr-only">{`${NBSP}kcal`}</span>
          </dd>
        </dl>
      </div>
    </div>
  );
}

export { CalorieBudget };
