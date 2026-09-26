import { macroEnergySplit } from "@/domain/recipes";
import { formatGrams, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const MACROS = [
  { key: "protein", field: "proteinG", label: "Protein", fill: "bg-protein", strong: "text-protein-strong" },
  { key: "carbs", field: "carbsG", label: "Kohlenhydrate", fill: "bg-carbs", strong: "text-carbs-strong" },
  { key: "fat", field: "fatG", label: "Fett", fill: "bg-fat", strong: "text-fat-strong" },
] as const;

export interface MacroSplitProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
  className?: string;
}

/**
 * Energy split of a dish: one stacked bar (share of kcal from P/C/F, 4/4/9) plus a three-column
 * legend with grams and percentage. No targets – recipes describe food, not progress.
 */
export function MacroSplit({ proteinG, carbsG, fatG, className }: MacroSplitProps) {
  const values = { proteinG, carbsG, fatG };
  const split = macroEnergySplit(values);
  const hasMacros = split.protein + split.carbs + split.fat > 0;
  const description = MACROS.map((m) => `${m.label} ${formatPercent(split[m.key])}`).join(", ");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        role="img"
        aria-label={hasMacros ? `Energieverteilung: ${description}` : "Noch keine Makronährstoffe"}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-track"
      >
        {hasMacros &&
          MACROS.map((m) =>
            split[m.key] > 0 ? (
              <span
                key={m.key}
                className={cn(
                  "h-full transition-[flex-grow] duration-300 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none",
                  m.fill,
                )}
                style={{ flexGrow: split[m.key], flexBasis: 0 }}
              />
            ) : null,
          )}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {MACROS.map((m) => (
          <div key={m.key} className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", m.fill)} />
              <span className="truncate">{m.label}</span>
            </dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="text-stat-sm text-foreground tabular">{formatGrams(values[m.field])}</span>
              <span className={cn("text-caption tabular", m.strong)}>{formatPercent(split[m.key])}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
