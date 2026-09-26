import { PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RecipeDetailActions } from "@/components/recipes/recipe-detail-actions";
import { RecipeNutritionSummary } from "@/components/recipes/recipe-nutrition-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatPortions, type OptionalRecipeNutrient, type RecipeNutrients } from "@/domain/recipes";
import { formatGrams, formatKcal, formatMg } from "@/lib/format";

import { loadRecipe } from "../load";

export async function generateMetadata({ params }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const recipe = await loadRecipe(id);
  return { title: recipe.name };
}

export default async function RecipeDetailPage({ params }: PageProps<"/recipes/[id]">) {
  const { id } = await params;
  const recipe = await loadRecipe(id);
  const { nutrition } = recipe;
  // The "1 Portion" serving is the linked food's default, so the log screen preselects it.
  const logHref = recipe.foodId ? `/log/food/${recipe.foodId}` : null;

  return (
    <div className="mx-auto flex max-w-content flex-col gap-4 px-gutter py-6">
      <PageHeader
        back={{ href: "/recipes", label: "Rezepte" }}
        eyebrow={formatPortions(recipe.servings)}
        title={recipe.name}
        subtitle={recipe.description ?? undefined}
        actions={<RecipeDetailActions recipeId={recipe.id} recipeName={recipe.name} />}
      />

      <Card>
        <CardContent className="flex flex-col gap-5">
          <RecipeNutritionSummary nutrition={nutrition} servings={recipe.servings} variant="detail" />
          {logHref ? (
            <Button asChild size="lg" block>
              <Link href={logHref}>
                <PlusCircle aria-hidden="true" />
                Portion loggen
              </Link>
            </Button>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              Speichere das Rezept erneut, um Portionen eintragen zu können.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Zutaten
            <span className="ml-2 text-body-sm font-medium text-muted-foreground tabular">
              {recipe.ingredients.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex min-h-14 items-center gap-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body font-medium text-foreground">{ing.food.name}</span>
                  <span className="truncate text-body-sm text-muted-foreground tabular">
                    {ing.amountLabel}
                  </span>
                </div>
                <span className="shrink-0 text-body-sm font-semibold text-foreground tabular">
                  {formatKcal(ing.kcal)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card variant="muted">
        <CardHeader>
          <CardTitle className="text-headline">Pro 100 g</CardTitle>
        </CardHeader>
        <CardContent>
          <NutrientTable n={nutrition.per100g} incomplete={nutrition.incomplete} />
          {nutrition.incomplete.length > 0 && (
            <p className="mt-3 text-caption text-muted-foreground">
              „mind.“ – nicht für alle Zutaten sind diese Werte bekannt.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const ROWS: { key: keyof RecipeNutrients; label: string; unit: "kcal" | "g" | "mg"; indent?: boolean }[] = [
  { key: "kcal", label: "Energie", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Kohlenhydrate", unit: "g" },
  { key: "sugarG", label: "davon Zucker", unit: "g", indent: true },
  { key: "fatG", label: "Fett", unit: "g" },
  { key: "saturatedFatG", label: "davon gesättigte Fettsäuren", unit: "g", indent: true },
  { key: "fiberG", label: "Ballaststoffe", unit: "g" },
  { key: "saltG", label: "Salz", unit: "g" },
  { key: "sodiumMg", label: "Natrium", unit: "mg" },
  { key: "potassiumMg", label: "Kalium", unit: "mg" },
  { key: "calciumMg", label: "Calcium", unit: "mg" },
  { key: "ironMg", label: "Eisen", unit: "mg" },
];

function NutrientTable({ n, incomplete }: { n: RecipeNutrients; incomplete: OptionalRecipeNutrient[] }) {
  const fmt = { kcal: formatKcal, g: formatGrams, mg: formatMg };
  return (
    <dl className="flex flex-col divide-y divide-border">
      {ROWS.filter((r) => n[r.key] != null).map((r) => (
        <div key={r.key} className="flex items-baseline justify-between gap-4 py-2">
          <dt
            className={r.indent ? "pl-4 text-body-sm text-muted-foreground" : "text-body-sm text-foreground"}
          >
            {r.label}
          </dt>
          <dd className="text-body-sm font-medium text-foreground tabular">
            {incomplete.includes(r.key as OptionalRecipeNutrient) ? "mind. " : ""}
            {fmt[r.unit](n[r.key])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
