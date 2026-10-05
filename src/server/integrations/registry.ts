import type { ActivitySource } from "@/domain/activity";
import { AppError } from "@/lib/errors";
import type { ServiceContext } from "@/server/context";
import { createAppleHealthProvider } from "./providers/apple-health";
import { createFitbitProvider } from "./providers/fitbit";
import { createGarminProvider } from "./providers/garmin";
import { createHealthConnectProvider } from "./providers/health-connect";
import { createManualProvider } from "./providers/manual";
import type { ActivityProvider, ActivityProviderFactory, ProviderAvailability } from "./types";

/** Provider id → factory. Swap an adapter by replacing its factory here (or via registerActivityProvider). */
const factories = new Map<ActivitySource, ActivityProviderFactory>([
  ["manual", createManualProvider],
  ["apple_health", createAppleHealthProvider],
  ["health_connect", createHealthConnectProvider],
  ["garmin", createGarminProvider],
  ["fitbit", createFitbitProvider],
]);

/** Registers or replaces a provider factory (tests, feature flags, a real adapter). Returns an undo fn. */
export function registerActivityProvider(id: ActivitySource, factory: ActivityProviderFactory): () => void {
  const previous = factories.get(id);
  factories.set(id, factory);
  return () => {
    if (previous) factories.set(id, previous);
    else factories.delete(id);
  };
}

export function listActivityProviderIds(): ActivitySource[] {
  return [...factories.keys()];
}

/** Provider bound to the user of `ctx`. Unknown id → AppError NOT_FOUND. */
export function getActivityProvider(ctx: ServiceContext, id: ActivitySource): ActivityProvider {
  const factory = factories.get(id);
  if (!factory) throw new AppError("NOT_FOUND", "Diese Datenquelle kennen wir nicht.");
  return factory(ctx);
}

export interface ActivityProviderStatus {
  id: ActivitySource;
  displayName: string;
  availability: ProviderAvailability;
}

/** All registered sources with their availability: for a "Datenquellen" settings list. */
export async function listActivityProviders(ctx: ServiceContext): Promise<ActivityProviderStatus[]> {
  return Promise.all(
    listActivityProviderIds().map(async (id) => {
      const p = getActivityProvider(ctx, id);
      return { id: p.id, displayName: p.displayName, availability: await p.isAvailable() };
    }),
  );
}
