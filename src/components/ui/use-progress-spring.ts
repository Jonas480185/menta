"use client";

import { useReducedMotion, useSpring, type MotionValue } from "motion/react";
import { useEffect } from "react";

import { spring } from "@/components/theme/tokens";

const { stiffness, damping, mass } = spring.ring;

/**
 * Motion value that springs (design token `spring.ring`) from 0 to `target` on mount and
 * between values on update. Jumps instantly under `prefers-reduced-motion` or when
 * `animate` is false: the final state is always correct without animation.
 */
export function useProgressSpring(target: number, animate = true): MotionValue<number> {
  const reduced = useReducedMotion();
  const value = useSpring(animate ? 0 : target, { stiffness, damping, mass });
  useEffect(() => {
    if (!animate || reduced) value.jump(target);
    else value.set(target);
  }, [target, animate, reduced, value]);
  return value;
}
