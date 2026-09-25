"use client";

import { useReducedMotion, useSpring, type MotionValue } from "motion/react";
import { useEffect } from "react";

/** Spring used by all progress visuals: quick, with a hint of overshoot. */
export const progressSpring = { stiffness: 140, damping: 22, mass: 1 } as const;

/**
 * Motion value that springs from 0 to `target` on mount and between values on update.
 * Jumps instantly under `prefers-reduced-motion` or when `animate` is false.
 */
export function useProgressSpring(target: number, animate = true): MotionValue<number> {
  const reduced = useReducedMotion();
  const value = useSpring(animate ? 0 : target, progressSpring);
  useEffect(() => {
    if (!animate || reduced) value.jump(target);
    else value.set(target);
  }, [target, animate, reduced, value]);
  return value;
}
