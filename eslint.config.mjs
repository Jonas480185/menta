import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ── Layer guardrails (see docs/architecture/technical.md → "Schichten & Abhängigkeitsregeln") ──
// Uses @typescript-eslint/no-restricted-imports so `import type { … }` stays allowed:
// types are erased at build time and don't create runtime coupling.

/** Opening a DB connection outside the singleton → second PGlite instance → corrupted data dir. */
const createDatabaseRestriction = {
  group: ["@/server/db/create", "**/server/db/create"],
  allowTypeImports: true,
  message: "Use getDb() from @/server/db/client (singleton). createDatabase() is only for scripts/tests.",
};

const dbDriverRestriction = {
  group: ["@/server/db", "@/server/db/*", "drizzle-orm", "drizzle-orm/*", "pg", "@electric-sql/*"],
  allowTypeImports: true,
  message:
    "No database access here. Data flows: Server Component/Action → service(ctx) → db. Pass data as props.",
};

const restrict = (...patterns) => ({
  "@typescript-eslint/no-restricted-imports": ["error", { patterns }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Default for all app code: no direct createDatabase().
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/db/**", "src/test/**"],
    rules: restrict(createDatabaseRestriction),
  },

  // Domain: pure, framework-free logic.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: restrict(
      {
        group: [
          "next",
          "next/*",
          "react",
          "react/*",
          "react-dom",
          "react-dom/*",
          "server-only",
          "client-only",
        ],
        message: "src/domain is framework-free (pure TypeScript). Move React/Next code to components/app.",
      },
      {
        group: ["@/server/*", "@/server/**", "@/app/*", "@/app/**", "@/components/*", "@/components/**"],
        allowTypeImports: true,
        message: "src/domain must not depend on server/app/components. Pass data in as arguments.",
      },
      {
        group: ["drizzle-orm", "drizzle-orm/*", "pg", "@electric-sql/*"],
        message: "src/domain must not touch the database. Put queries in src/server/services.",
      },
    ),
  },

  // Components (mostly client) and shared lib: no database / services with DB access.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/hooks/**/*.{ts,tsx}"],
    rules: restrict(dbDriverRestriction),
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: restrict(dbDriverRestriction, {
      group: ["@/server/*", "@/server/**"],
      allowTypeImports: true,
      message: "src/lib is shared by client and server – it must not import server modules.",
    }),
  },

  // Tests may do anything (createTestDb, fixtures, …).
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "@typescript-eslint/no-restricted-imports": "off" },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local data / generated artifacts:
    ".data/**",
    "data/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
