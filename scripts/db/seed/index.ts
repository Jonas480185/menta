import { extensionsStep } from "./01-extensions";
import { foodsStep } from "./02-foods";
import { demoDataStep } from "./03-demo-data";
import type { SeedStep } from "./types";

/** Ordered seed steps. Add new steps here (each must be idempotent). */
export const SEED_STEPS: SeedStep[] = [extensionsStep, foodsStep, demoDataStep];

export { runSeed } from "./run";
export type { SeedStep, SeedContext, SeedStepResult } from "./types";
