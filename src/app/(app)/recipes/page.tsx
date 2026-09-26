import { ChefHat, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RecipeCard } from "@/components/recipes/recipe-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedContext } from "@/server/auth/context";
import { listRecipes } from "@/server/services/recipes";

export const metadata: Metadata = { title: "Rezepte" };

export default async function RecipesPage() {
  const ctx = await requireOnboardedContext();
  const recipes = await listRecipes(ctx);

  return (
    <div className="mx-auto max-w-content px-gutter py-6">
      <PageHeader
        title="Rezepte"
        subtitle={recipes.length > 0 ? "Koch einmal, logge immer wieder." : undefined}
        actions={
          recipes.length > 0 ? (
            <Button asChild size="sm">
              <Link href="/recipes/new">
                <Plus aria-hidden="true" />
                Neues Rezept
              </Link>
            </Button>
          ) : undefined
        }
      />

      {recipes.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<ChefHat />}
          title="Koch einmal, logge immer wieder."
          description="Leg ein Rezept mit seinen Zutaten an – danach trägst du eine Portion mit einem Tipp ein."
          action={
            <Button asChild>
              <Link href="/recipes/new">
                <Plus aria-hidden="true" />
                Erstes Rezept anlegen
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {recipes.map((r) => (
            <li key={r.id}>
              <RecipeCard recipe={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
