import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";

import { isAppError } from "@/lib/errors";
import { requireOnboardedContext } from "@/server/auth/context";
import { getRecipe } from "@/server/services/recipes";

/** Loads the signed-in user's recipe for a page; unknown/foreign ids render the 404 page. */
export const loadRecipe = cache(async (id: string) => {
  const ctx = await requireOnboardedContext();
  try {
    return await getRecipe(ctx, id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
});
