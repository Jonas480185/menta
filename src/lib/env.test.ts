import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvError, env, getEnv, parseEnv, resetEnvCache } from "./env";

const LONG_SECRET = "x".repeat(32);

describe("parseEnv", () => {
  it("applies safe defaults in development", () => {
    const e = parseEnv({});
    expect(e.NODE_ENV).toBe("development");
    expect(e.DATABASE_URL).toBeUndefined();
    expect(e.dbDriver).toBe("pglite");
    expect(e.PGLITE_DATA_DIR).toBe("./.data/pglite");
    expect(e.DB_POOL_MAX).toBe(10);
    expect(e.USDA_API_KEY).toBe("DEMO_KEY");
    expect(e.FOOD_EXTERNAL_PROVIDERS_ENABLED).toBe(true);
    expect(e.BETTER_AUTH_SECRET.length).toBeGreaterThan(0);
    expect(e.authSecretIsPlaceholder).toBe(true);
    expect(e.isDevelopment).toBe(true);
  });

  it("treats empty strings as unset (DATABASE_URL= in .env)", () => {
    const e = parseEnv({ DATABASE_URL: "", PGLITE_DATA_DIR: "  ", USDA_API_KEY: "" });
    expect(e.DATABASE_URL).toBeUndefined();
    expect(e.PGLITE_DATA_DIR).toBe("./.data/pglite");
    expect(e.USDA_API_KEY).toBe("DEMO_KEY");
  });

  it("selects postgres for postgres:// URLs", () => {
    expect(parseEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db" }).dbDriver).toBe("postgres");
    expect(parseEnv({ DATABASE_URL: "postgresql://localhost/db" }).dbDriver).toBe("postgres");
  });

  it("falls back to POSTGRES_URL (Vercel integrations), DATABASE_URL wins", () => {
    expect(parseEnv({ POSTGRES_URL: "postgres://a/db" }).DATABASE_URL).toBe("postgres://a/db");
    expect(parseEnv({ POSTGRES_URL: "postgres://a/db" }).dbDriver).toBe("postgres");
    expect(
      parseEnv({ DATABASE_URL: "postgres://b/db", POSTGRES_URL: "postgres://a/db" }).DATABASE_URL,
    ).toBe("postgres://b/db");
  });

  it("accepts a PEM DATABASE_SSL_CA with escaped newlines", () => {
    const e = parseEnv({ DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----" });
    expect(e.DATABASE_SSL_CA).toBe("-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----");
    expect(() => parseEnv({ DATABASE_SSL_CA: "nope" })).toThrow(/DATABASE_SSL_CA/);
  });

  it("keeps the public demo off unless DEMO_MODE is set", () => {
    expect(parseEnv({}).DEMO_MODE).toBe(false);
    expect(parseEnv({}).DEMO_EMAIL).toBe("demo@menta.app");
    expect(parseEnv({ DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
  });

  it("rejects non-postgres DATABASE_URLs with a clear message", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL: must start with postgres/,
    );
  });

  it.each([
    ["false", false],
    ["0", false],
    ["off", false],
    ["NO", false],
    ["true", true],
    ["1", true],
    ["yes", true],
  ])("parses FOOD_EXTERNAL_PROVIDERS_ENABLED=%s", (value, expected) => {
    expect(parseEnv({ FOOD_EXTERNAL_PROVIDERS_ENABLED: value }).FOOD_EXTERNAL_PROVIDERS_ENABLED).toBe(
      expected,
    );
  });

  it("rejects invalid booleans", () => {
    expect(() => parseEnv({ FOOD_EXTERNAL_PROVIDERS_ENABLED: "maybe" })).toThrow(EnvError);
  });

  it("coerces DB_POOL_MAX", () => {
    expect(parseEnv({ DB_POOL_MAX: "4" }).DB_POOL_MAX).toBe(4);
    expect(() => parseEnv({ DB_POOL_MAX: "0" })).toThrow(/DB_POOL_MAX/);
  });

  it("requires a strong BETTER_AUTH_SECRET in production", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET: required in production/);
    expect(() => parseEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: "short" })).toThrow(/at least 32/);
    const e = parseEnv({ NODE_ENV: "production", BETTER_AUTH_SECRET: LONG_SECRET });
    expect(e.BETTER_AUTH_SECRET).toBe(LONG_SECRET);
    expect(e.isProduction).toBe(true);
    expect(e.authSecretIsPlaceholder).toBe(false);
  });

  it("does not require the secret during `next build`", () => {
    const e = parseEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" });
    expect(e.isProduction).toBe(true);
  });

  it("flags the .env.example placeholder secret", () => {
    const e = parseEnv({ BETTER_AUTH_SECRET: "change-me-to-a-long-random-string" });
    expect(e.authSecretIsPlaceholder).toBe(true);
  });

  it("parses BETTER_AUTH_TRUSTED_ORIGINS as a trimmed list", () => {
    expect(parseEnv({}).BETTER_AUTH_TRUSTED_ORIGINS).toEqual([]);
    expect(
      parseEnv({ BETTER_AUTH_TRUSTED_ORIGINS: " https://a.example.com, http://localhost:*,," })
        .BETTER_AUTH_TRUSTED_ORIGINS,
    ).toEqual(["https://a.example.com", "http://localhost:*"]);
  });

  it("validates BETTER_AUTH_URL and treats it as optional", () => {
    expect(parseEnv({}).BETTER_AUTH_URL).toBeUndefined();
    expect(parseEnv({ BETTER_AUTH_URL: "http://localhost:3127" }).BETTER_AUTH_URL).toBe(
      "http://localhost:3127",
    );
    expect(() => parseEnv({ BETTER_AUTH_URL: "localhost" })).toThrow(/BETTER_AUTH_URL/);
  });

  it("accepts AUTH_SECRET as alias for BETTER_AUTH_SECRET", () => {
    const e = parseEnv({ NODE_ENV: "production", AUTH_SECRET: LONG_SECRET });
    expect(e.BETTER_AUTH_SECRET).toBe(LONG_SECRET);
  });

  it("lists all problems at once", () => {
    try {
      parseEnv({ NODE_ENV: "production", DATABASE_URL: "nope", LOG_LEVEL: "loud" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const issues = (err as EnvError).issues.join("\n");
      expect(issues).toContain("DATABASE_URL");
      expect(issues).toContain("LOG_LEVEL");
      expect((err as Error).message).toContain(".env.example");
    }
  });
});

describe("env (lazy)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it("reads process.env on first access and caches", () => {
    vi.stubEnv("USDA_API_KEY", "abc");
    resetEnvCache();
    expect(env.USDA_API_KEY).toBe("abc");
    vi.stubEnv("USDA_API_KEY", "changed");
    expect(getEnv().USDA_API_KEY).toBe("abc");
    resetEnvCache();
    expect(env.USDA_API_KEY).toBe("changed");
  });

  it("uses NODE_ENV=test under vitest", () => {
    expect(env.isTest).toBe(true);
  });
});
