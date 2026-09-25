import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "../../../src/server/db/create";
import { runSeed, SEED_STEPS, type SeedStep } from "./index";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("seed runner", () => {
  it("runs all steps and is safe to run twice", async () => {
    const logs: string[] = [];
    const first = await runSeed(db, SEED_STEPS, { log: (m) => logs.push(m) });
    const second = await runSeed(db, SEED_STEPS, { log: () => {} });
    expect(first.map((r) => r.name)).toEqual([
      "extensions",
      "foods",
      "demo-data",
    ]);
    expect(first.every((r) => r.status !== "failed")).toBe(true);
    expect(second.map((r) => r.status)).toEqual(first.map((r) => r.status));
    expect(logs.some((l) => l.includes("demo-data"))).toBe(true);
  });

  it("supports --only and rejects unknown step names", async () => {
    const report = await runSeed(db, SEED_STEPS, {
      only: ["extensions"],
      log: () => {},
    });
    expect(report.map((r) => r.name)).toEqual(["extensions"]);
    await expect(
      runSeed(db, SEED_STEPS, { only: ["nope"], log: () => {} }),
    ).rejects.toThrow(/Unknown seed step/);
  });

  it("stops at the first failing step", async () => {
    const ran: string[] = [];
    const steps: SeedStep[] = [
      { name: "a", description: "a", run: async () => void ran.push("a") },
      {
        name: "b",
        description: "b",
        run: async () => {
          throw new Error("boom");
        },
      },
      { name: "c", description: "c", run: async () => void ran.push("c") },
    ];
    await expect(runSeed(db, steps, { log: () => {} })).rejects.toThrow("boom");
    expect(ran).toEqual(["a"]);
  });
});
