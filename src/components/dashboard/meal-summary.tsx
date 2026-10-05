import Link from "next/link";
import { Plus } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { DayMealGroup } from "@/server/services/nutrition";
import { MealIcon } from "./meal-icon";

/** Meal list for the dashboard (Yazio pattern): icon tile, name, entry preview, kcal and a round add button. */
export function MealSummary({ meals, date }: { meals: DayMealGroup[]; date: string }) {
  return (
    <ul className="grid gap-2 xl:grid-cols-2">
      {meals.map(({ meal, totals, entries }) => (
        <li key={meal.id} className="flex items-center gap-3 rounded-card bg-card py-2.5 pr-2.5 pl-3 shadow-xs transition-shadow hover:shadow-md">
          <Link
            href={`/diary/${date}#meal-${meal.id}`}
            className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg"
          >
            <MealIcon name={meal.name} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-headline">{meal.name}</span>
                <span className="shrink-0 tabular text-body-sm text-muted-foreground">
                  {entries.length ? (
                    <>
                      <span className="font-semibold text-foreground">{formatNumber(totals.kcal)}</span> kcal
                    </>
                  ) : (
                    "–"
                  )}
                </span>
              </span>
              <span className="line-clamp-1 text-body-sm text-muted-foreground">
                {entries.length ? entries.map((e) => e.foodName).join(", ") : "Noch nichts eingetragen"}
              </span>
            </span>
          </Link>
          <Link
            href={`/log?date=${date}&meal=${meal.id}`}
            aria-label={`Zu ${meal.name} hinzufügen`}
            className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90"
          >
            <Plus className="size-5" strokeWidth={2.5} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
