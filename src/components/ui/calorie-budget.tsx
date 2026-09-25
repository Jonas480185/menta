import { cn } from "@/lib/utils";

import { formatNumber } from "./number-utils";
import { computeProgress, sanitize } from "./progress-math";

export interface CalorieBudgetProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Eaten today (kcal). */
  consumed: number;
  /** Daily goal (kcal). */
  target: number;
  /** Activity calories that extend the budget (optional, kcal). */
  activity?: number;
  /** Centre slot – typically a `ProgressRing` over `target + activity`. */
  children?: React.ReactNode;
  /** Show the "Ziel − Gegessen + Aktivität" breakdown line. */
  showFormula?: boolean;
  unit?: string;
}

/**
 * Consumed / remaining pair around an optional centre visual. "Übrig" turns into
 * "Über Ziel" past the budget – informative, not alarming.
 */
function CalorieBudget({
  consumed,
  target,
  activity = 0,
  children,
  showFormula = false,
  unit = "kcal",
  className,
  ...props
}: CalorieBudgetProps) {
  const budget = sanitize(target) + sanitize(activity);
  const p = computeProgress(consumed, budget);
  const remaining = budget - sanitize(consumed);

  return (
    <div data-slot="calorie-budget" className={cn("flex flex-col gap-3", className)} {...props}>
      <div className={cn("grid items-center gap-3", children ? "grid-cols-[1fr_auto_1fr]" : "grid-cols-2")}>
        <BudgetFigure label="Gegessen" value={sanitize(consumed)} unit={unit} />
        {children && <div className="flex justify-center">{children}</div>}
        <BudgetFigure
          label={p.isOver ? "Über Ziel" : "Übrig"}
          value={Math.abs(remaining)}
          unit={unit}
          align="end"
          emphasis={p.isOver ? "over" : "default"}
        />
      </div>
      {showFormula && (
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          Ziel {formatNumber(sanitize(target))}
          {sanitize(activity) > 0 && <> + Aktivität {formatNumber(sanitize(activity))}</>} − Gegessen {formatNumber(sanitize(consumed))}
          {" = "}
          <span className="font-medium text-foreground">
            {remaining < 0 ? "−" : ""}
            {formatNumber(Math.abs(remaining))}&#8239;{unit}
          </span>
        </p>
      )}
    </div>
  );
}

function BudgetFigure({
  label,
  value,
  unit,
  align = "start",
  emphasis = "default",
}: {
  label: string;
  value: number;
  unit: string;
  align?: "start" | "end";
  emphasis?: "default" | "over";
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", align === "end" ? "items-end text-right" : "items-start text-left")}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span
        className={cn(
          "text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl",
          emphasis === "over" ? "text-over" : "text-foreground",
        )}
      >
        {formatNumber(value)}
      </span>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  );
}

export { CalorieBudget };
