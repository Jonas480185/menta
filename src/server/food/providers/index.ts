import "server-only";
/**
 * App-facing entry point for food providers (server-only). Scripts (tsx) must import the
 * implementation modules directly (`./open-food-facts`, `./usda`, `./local`) because
 * `server-only` throws outside the React Server environment.
 */
import type { Db } from "@/server/db/create";
import { LocalFoodProvider } from "./local";
import { OpenFoodFactsProvider } from "./open-food-facts";
import { UsdaProvider } from "./usda";

export { LocalFoodProvider } from "./local";
export { OpenFoodFactsProvider, type OpenFoodFactsProviderOptions } from "./open-food-facts";
export { UsdaProvider, type UsdaProviderOptions } from "./usda";
export { externalProvidersEnabled } from "./config";
export { HttpError } from "./http";

export interface FoodProviders {
  local: LocalFoodProvider;
  off: OpenFoodFactsProvider;
  usda: UsdaProvider;
}

/** Default provider set (env-configured). Food Search orchestrates them. */
export function createFoodProviders(db: Db): FoodProviders {
  return { local: new LocalFoodProvider(db), off: new OpenFoodFactsProvider(), usda: new UsdaProvider() };
}
