import type { Metadata } from "next";

import { RecipeBuilder } from "@/components/recipes/recipe-builder";
import { PageHeader } from "@/components/ui/page-header";

import { loadRecipe } from "../../load";

export const metadata: Metadata = { title: "Rezept bearbeiten" };

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  const { id } = await params;
  const recipe = await loadRecipe(id);

  return (
    <div className="mx-auto max-w-content px-gutter py-6 lg:max-w-wide">
      <PageHeader back={{ href: `/recipes/${recipe.id}`, label: recipe.name }} title="Rezept bearbeiten" />
      <RecipeBuilder
        initial={{
          id: recipe.id,
          foodId: recipe.foodId,
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          totalWeightG: recipe.totalWeightG,
          ingredients: recipe.ingredients.map((i) => ({
            key: i.id,
            food: i.food,
            servingId: i.servingId,
            quantity: i.quantity,
          })),
        }}
      />
    </div>
  );
}
