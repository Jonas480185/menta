import { defineConfig, devices } from "@playwright/test";

/** E2E against a running production server: `pnpm build && pnpm start --port 3200`, then `pnpm test:e2e`. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3200", ...devices["iPhone 13"], browserName: "chromium" },
});
