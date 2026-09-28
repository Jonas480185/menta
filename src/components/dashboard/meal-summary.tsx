import Link from "next/link";
import { Plus } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { DayMealGroup } from "@/server/services/nutrition";

/** Compact meal list for dashboard/diary: name, kcal, entry preview, add button. */
export function MealSummary({ meals, date }: { meals: DayMealGroup[]; date: string }) {
  return (
    <ul className="divide-y divide-border rounded-card bg-card shadow-xs">
      {meals.map(({ meal, totals, entries }) => (
        <li key={meal.id} className="flex items-center gap-3 px-4 py-3">
          <Link href={`/diary/${date}#meal-${meal.id}`} className="focus-ring min-w-0 flex-1 rounded-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-body font-medium">{meal.name}</span>
              <span className="tabular text-body-sm text-muted-foreground">
                {entries.length ? `${formatNumber(totals.kcal)} kcal` : "–"}
              </span>
            </div>
            <p className="line-clamp-1 text-body-sm text-muted-foreground">
              {entries.length ? entries.map((e) => e.foodName).join(", ") : "Noch nichts eingetragen"}
            </p>
          </Link>
          <Link
            href={`/log?date=${date}&meal=${meal.id}`}
            aria-label={`Zu ${meal.name} hinzufügen`}
            className="focus-ring flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"
          >
            <Plus className="size-5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
