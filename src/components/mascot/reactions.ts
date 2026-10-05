/**
 * Milo's interaction rules – pure and framework-free so they can be unit tested.
 * Randomness is injected (`rand` returns [0, 1)) to keep everything deterministic in tests.
 */
import type { MiloMood } from "./milo";

/** Body choreography Milo plays in response to an interaction. */
export type MiloReaction =
  | "hop"
  | "wiggle"
  | "spin"
  | "giggle"
  | "love"
  | "flip"
  | "dizzy"
  | "powerup"
  | "wee";

/** Temporary face that overrides the mood face while a reaction plays. */
export type MiloFace = "mood" | "surprised" | "squint" | "love" | "dizzy" | "wink" | "charging";

/** Particle kinds Milo can emit. */
export type ParticleKind = "heart" | "sparkle" | "confetti" | "leaf" | "zzz" | "note" | "bubble";

export interface ReactionSpec {
  face: MiloFace;
  particles: { kind: ParticleKind; count: number } | null;
  lines: readonly string[];
  /** How long the reaction face and speech line stay visible (ms). */
  durationMs: number;
}

export const REACTIONS: Record<MiloReaction, ReactionSpec> = {
  hop: { face: "squint", particles: { kind: "sparkle", count: 5 }, lines: ["Hopp!", "Huiii!", "Nochmal!"], durationMs: 1100 },
  wiggle: { face: "wink", particles: { kind: "leaf", count: 4 }, lines: ["Hihi, das kitzelt!", "Wackel, wackel!"], durationMs: 1200 },
  spin: { face: "squint", particles: { kind: "sparkle", count: 8 }, lines: ["Wirbelwind!", "Einmal rundherum!"], durationMs: 1300 },
  giggle: { face: "squint", particles: { kind: "note", count: 3 }, lines: ["Hihihi!", "Tralala!", "Ich mag dich auch!"], durationMs: 1300 },
  love: { face: "love", particles: { kind: "heart", count: 6 }, lines: ["Aww, danke!", "Streicheleinheit!", "Das tut gut."], durationMs: 1800 },
  flip: { face: "surprised", particles: { kind: "confetti", count: 14 }, lines: ["Salto!", "Ta-daa!"], durationMs: 1400 },
  dizzy: { face: "dizzy", particles: { kind: "sparkle", count: 6 }, lines: ["Uff, mir ist schwindelig …", "Langsam, langsam!"], durationMs: 2200 },
  powerup: { face: "charging", particles: { kind: "confetti", count: 24 }, lines: ["Power-Up! Volle Energie!", "Konfetti-Explosion!"], durationMs: 2000 },
  wee: { face: "surprised", particles: { kind: "sparkle", count: 6 }, lines: ["Wuiii!", "Lass mich runter!", "Ich kann fliegen!"], durationMs: 1300 },
};

/** Taps faster than this count towards a combo; a combo of DIZZY_TAPS makes Milo dizzy. */
export const TAP_WINDOW_MS = 1800;
export const DIZZY_TAPS = 6;
export const DOUBLE_TAP_MS = 320;
export const LONG_PRESS_MS = 650;

/** Keeps only taps inside the combo window and appends `now`. */
export function registerTap(history: readonly number[], now: number, windowMs = TAP_WINDOW_MS): number[] {
  return [...history.filter((t) => now - t < windowMs), now];
}

const TAP_POOL: readonly MiloReaction[] = ["hop", "hop", "wiggle", "spin", "giggle", "love"];

/**
 * Which reaction a single tap triggers. A fast double tap flips, a long combo makes Milo dizzy,
 * otherwise a weighted random pick that never repeats the previous reaction twice in a row.
 */
export function pickTapReaction(
  history: readonly number[],
  previous: MiloReaction | null,
  rand: () => number,
): MiloReaction {
  const n = history.length;
  if (n >= DIZZY_TAPS) return "dizzy";
  if (n >= 2 && history[n - 1] - history[n - 2] < DOUBLE_TAP_MS) return "flip";
  const pool = TAP_POOL.filter((r) => r !== previous);
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

export function pickLine(reaction: MiloReaction, rand: () => number): string {
  const lines = REACTIONS[reaction].lines;
  return lines[Math.min(lines.length - 1, Math.floor(rand() * lines.length))];
}

/** Small idle behaviours Milo plays on his own between interactions. */
export type IdleBehaviour = "lookAround" | "hop" | "wiggle" | "sparkle" | "yawn" | "hum";

export function pickIdle(mood: MiloMood, rand: () => number): IdleBehaviour {
  const pool: readonly IdleBehaviour[] =
    mood === "sleepy"
      ? ["yawn", "yawn", "lookAround"]
      : mood === "celebrating" || mood === "goal_reached" || mood === "streak"
        ? ["hop", "sparkle", "wiggle", "hum"]
        : mood === "thinking"
          ? ["lookAround", "lookAround", "wiggle"]
          : ["lookAround", "hop", "wiggle", "sparkle", "hum"];
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/** Random delay until the next idle behaviour / blink, in ms. */
export function nextDelay(minMs: number, maxMs: number, rand: () => number): number {
  return Math.round(minMs + rand() * (maxMs - minMs));
}

/**
 * Normalised gaze offset (-1 … 1 per axis) from Milo's centre towards a pointer.
 * Saturates at `reach` px so far-away pointers still read as "looking that way".
 */
export function gazeTowards(
  center: { x: number; y: number },
  pointer: { x: number; y: number },
  reach = 240,
): { x: number; y: number } {
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return { x: 0, y: 0 };
  const k = Math.min(1, dist / reach) / dist;
  return { x: dx * k, y: dy * k };
}

/** Accumulates petting distance; returns the new total and whether it crossed the threshold. */
export function addPetting(total: number, delta: number, threshold = 420): { total: number; triggered: boolean } {
  const next = total + Math.abs(delta);
  return next >= threshold ? { total: 0, triggered: true } : { total: next, triggered: false };
}
