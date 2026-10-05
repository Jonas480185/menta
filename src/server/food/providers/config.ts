/**
 * Runtime configuration for external food providers, read from the validated server env
 * (`@/lib/env`, lazy + cached: tests call `resetEnvCache()` after `vi.stubEnv`).
 * Kept free of `server-only` so tsx scripts can import it.
 */
import { env } from "@/lib/env";

/** FOOD_EXTERNAL_PROVIDERS_ENABLED=false → providers answer empty/null without network. */
export function externalProvidersEnabled(): boolean {
  return env.FOOD_EXTERNAL_PROVIDERS_ENABLED;
}

/** Open Food Facts requires `AppName/Version (ContactEmail)`. */
export function offUserAgent(): string {
  return env.OFF_USER_AGENT;
}

export function usdaApiKey(): string {
  return env.USDA_API_KEY;
}

export interface RateLimit {
  /** Burst size (tokens). */
  capacity: number;
  /** Requests allowed per `perMs`. */
  requests: number;
  perMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Documented upstream limits (checked 2026-09, see docs/architecture/food-data-strategy.md):
 * - OFF product reads: 15 req/min/IP     (openfoodfacts.github.io/openfoodfacts-server/api)
 * - OFF search (API v2 / search.pl): 10 req/min/IP
 * - OFF search-a-licious: no published limit, we self-limit to 30 req/min
 * - USDA FDC (api.data.gov): 1,000 req/h per key; DEMO_KEY 30 req/h & 50/day documented,
 *   the live `X-RateLimit-Limit` header for DEMO_KEY currently reports 10/h → we use 10/h.
 */
export const RATE_LIMITS = {
  offProduct: { capacity: 5, requests: 15, perMs: MINUTE },
  offSearch: { capacity: 2, requests: 10, perMs: MINUTE },
  offSearchALicious: { capacity: 5, requests: 30, perMs: MINUTE },
  usda: { capacity: 10, requests: 1000, perMs: HOUR },
  usdaDemo: { capacity: 3, requests: 10, perMs: HOUR },
} as const satisfies Record<string, RateLimit>;
