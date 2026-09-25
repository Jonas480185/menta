import { z } from "zod";

/**
 * Server environment – validated with Zod, parsed lazily on first access.
 *
 *   import { env } from "@/lib/env";
 *   if (env.FOOD_EXTERNAL_PROVIDERS_ENABLED) …
 *
 * - Lazy: importing this module never throws, so `next build` works without secrets.
 *   The first property access parses `process.env` and caches the result.
 * - Dev/test get safe defaults. Production requires BETTER_AUTH_SECRET (≥ 32 chars),
 *   except during `next build` (NEXT_PHASE=phase-production-build).
 * - Empty strings (`DATABASE_URL=` in .env) count as "not set".
 * - Server only: secrets are never available in the browser bundle anyway, and accessing
 *   `env` in the browser throws a clear error. Intentionally free of `server-only` so
 *   scripts (tsx) and tests can use it.
 */

export const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;

const DEV_AUTH_SECRET = "dev-only-insecure-secret-never-use-in-production";
const PLACEHOLDER_SECRETS = new Set(["change-me-to-a-long-random-string", DEV_AUTH_SECRET]);

const booleanString = z.union([z.boolean(), z.string()]).transform((value, ctx) => {
  if (typeof value === "boolean") return value;
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;
  ctx.addIssue({ code: "custom", message: `expected true/false, got "${value}"` });
  return z.NEVER;
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Set during `next build` by Next.js. */
    NEXT_PHASE: z.string().optional(),

    // ── Database ────────────────────────────────────────────────────────
    /** postgres:// URL → node-postgres. Unset → embedded PGlite. */
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, "must start with postgres:// or postgresql://")
      .optional(),
    /** PGlite data directory (only used when DATABASE_URL is unset). */
    PGLITE_DATA_DIR: z.string().default("./.data/pglite"),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    // ── Auth ────────────────────────────────────────────────────────────
    BETTER_AUTH_SECRET: z.string().optional(),
    BETTER_AUTH_URL: z.url().optional(),

    // ── Food providers ──────────────────────────────────────────────────
    USDA_API_KEY: z.string().default("DEMO_KEY"),
    OFF_USER_AGENT: z.string().default("NutritionApp/0.1 (dev@example.com)"),
    FOOD_EXTERNAL_PROVIDERS_ENABLED: booleanString.default(true),

    // ── Logging ─────────────────────────────────────────────────────────
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  })
  .transform((raw, ctx) => {
    const isProduction = raw.NODE_ENV === "production";
    const isBuild = raw.NEXT_PHASE === "phase-production-build";
    let secret = raw.BETTER_AUTH_SECRET;
    if (isProduction && !isBuild) {
      if (!secret) {
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_SECRET"],
          message: "required in production (generate one with `openssl rand -base64 32`)",
        });
      } else if (secret.length < 32) {
        ctx.addIssue({
          code: "custom",
          path: ["BETTER_AUTH_SECRET"],
          message: "must be at least 32 characters in production",
        });
      }
    }
    secret ??= DEV_AUTH_SECRET;
    return {
      ...raw,
      BETTER_AUTH_SECRET: secret,
      /** True when the auth secret is a known placeholder (fine locally, log a warning in prod). */
      authSecretIsPlaceholder: PLACEHOLDER_SECRETS.has(secret),
      isProduction,
      isTest: raw.NODE_ENV === "test",
      isDevelopment: raw.NODE_ENV === "development",
      dbDriver: (raw.DATABASE_URL ? "postgres" : "pglite") as "postgres" | "pglite",
    };
  });

export type ServerEnv = z.output<typeof envSchema>;

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  • ${i}`).join("\n")}\nSee .env.example.`,
    );
    this.name = "EnvError";
  }
}

/** Pure parser (no caching) – use in tests. Empty strings are treated as unset. */
export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== "") cleaned[key] = value.trim();
  }
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Parsed + cached server env. Throws EnvError with all problems listed. */
export function getEnv(): ServerEnv {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "test") {
    throw new Error("@/lib/env is server-only – pass values to client components as props.");
  }
  cached ??= parseEnv(process.env);
  return cached;
}

/** Test helper: forget the cached env so the next access re-reads process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}

/** Lazy proxy: `env.X` parses on first access. */
export const env: Readonly<ServerEnv> = new Proxy({} as ServerEnv, {
  get: (_target, key) => getEnv()[key as keyof ServerEnv],
  has: (_target, key) => key in getEnv(),
  ownKeys: () => Reflect.ownKeys(getEnv()),
  getOwnPropertyDescriptor: (_target, key) => ({
    value: getEnv()[key as keyof ServerEnv],
    enumerable: true,
    configurable: true,
  }),
});
