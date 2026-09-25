import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 60_000,
    // Each DB test file boots its own PGlite (WASM, CPU-heavy) – cap parallelism so the suite
    // stays stable on busy machines.
    maxWorkers: 4,
    hookTimeout: 60_000,
  },
});
