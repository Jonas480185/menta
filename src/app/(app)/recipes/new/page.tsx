import type { Metadata } from "next";

import { RecipeBuilder } from "@/components/recipes/recipe-builder";
import { PageHeader } from "@/components/ui/page-header";
import { requireOnboardedContext } from "@/server/auth/context";

export const metadata: Metadata = { title: "Neues Rezept" };

export default async function NewRecipePage() {
  await requireOnboardedContext();
  return (
    <div className="mx-auto max-w-content px-gutter py-6 lg:max-w-wide">
      <PageHeader back={{ href: "/recipes", label: "Rezepte" }} title="Neues Rezept" />
      <RecipeBuilder />
    </div>
  );
}
