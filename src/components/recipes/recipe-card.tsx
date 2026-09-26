import Link from "next/link";

import { Card } from "@/components/ui/card";
import { MacroChips } from "@/components/ui/macro-chips";
import { formatPortions } from "@/domain/recipes";
import { formatNumber } from "@/lib/format";
import type { RecipeListItem } from "@/server/services/recipes";

/** Tappable recipe summary for the /recipes list: name, kcal + macros per portion, portions. */
export function RecipeCard({ recipe }: { recipe: RecipeListItem }) {
  const p = recipe.perServing;
  return (
    <Card asChild interactive className="gap-3 px-card">
      <Link href={`/recipes/${recipe.id}`} aria-label={`${recipe.name} öffnen`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="line-clamp-2 text-headline text-foreground">{recipe.name}</h2>
            <p className="text-body-sm text-muted-foreground">
              {formatPortions(recipe.servings)} ·{" "}
              {recipe.ingredientCount === 1 ? "1 Zutat" : `${recipe.ingredientCount} Zutaten`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-stat-sm text-foreground tabular">{p ? formatNumber(p.kcal) : "–"}</span>
            <span className="text-caption text-muted-foreground">kcal/Portion</span>
          </div>
        </div>
        {p && <MacroChips protein={p.proteinG} carbs={p.carbsG} fat={p.fatG} variant="soft" />}
      </Link>
    </Card>
  );
}
