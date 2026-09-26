import { describe, expect, it } from "vitest";
import { isFoodStale } from "./refresh";

const now = new Date("2026-09-26T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe("isFoodStale", () => {
  it("refreshes OFF products after 30 days", () => {
    expect(isFoodStale("off", daysAgo(29), now)).toBe(false);
    expect(isFoodStale("off", daysAgo(31), now)).toBe(true);
    expect(isFoodStale("off", null, now)).toBe(true);
  });

  it("never live-refreshes static or owned sources", () => {
    for (const s of ["usda", "curated", "user", "recipe", "unknown"]) expect(isFoodStale(s, daysAgo(999), now)).toBe(false);
  });
});
