import { performance } from "node:perf_hooks";
import type { Db } from "../../../src/server/db/create";
import type { SeedStep, SeedStepResult } from "./types";

export interface SeedRunReport {
  name: string;
  status: SeedStepResult["status"] | "failed";
  message?: string;
  ms: number;
}

export interface RunSeedOptions {
  /** Only run steps with these names (keeps order). */
  only?: string[];
  log?: (message: string) => void;
}

/**
 * Runs seed steps sequentially, logs timing per step and stops at the first failure
 * (later steps usually depend on earlier ones). Returns a report; throws on failure.
 */
export async function runSeed(
  db: Db,
  steps: SeedStep[],
  opts: RunSeedOptions = {},
): Promise<SeedRunReport[]> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const selected = opts.only?.length
    ? steps.filter((s) => opts.only!.includes(s.name))
    : steps;
  const unknown =
    opts.only?.filter((n) => !steps.some((s) => s.name === n)) ?? [];
  if (unknown.length)
    throw new Error(`Unknown seed step(s): ${unknown.join(", ")}`);

  const report: SeedRunReport[] = [];
  for (const step of selected) {
    const t0 = performance.now();
    log(`→ ${step.name}: ${step.description}`);
    try {
      const result = (await step.run({ db, log: (m) => log(`    ${m}`) })) ?? {
        status: "done" as const,
      };
      const ms = performance.now() - t0;
      report.push({
        name: step.name,
        status: result.status,
        message: result.message,
        ms,
      });
      const icon = result.status === "done" ? "✓" : "–";
      log(
        `  ${icon} ${step.name} ${result.status} in ${ms.toFixed(0)} ms${result.message ? ` (${result.message})` : ""}`,
      );
    } catch (err) {
      const ms = performance.now() - t0;
      report.push({
        name: step.name,
        status: "failed",
        message: err instanceof Error ? err.message : String(err),
        ms,
      });
      log(`  ✗ ${step.name} failed after ${ms.toFixed(0)} ms`);
      throw err;
    }
  }
  return report;
}
