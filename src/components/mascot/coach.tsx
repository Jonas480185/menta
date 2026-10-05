"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissMascotAction } from "@/app/(app)/today/actions";
import type { MascotMessage } from "@/domain/engagement";
import { formatNumber } from "@/lib/format";
import { MiloBuddy } from "./milo-buddy";

const PETS_KEY = "menta.milo.pets";
const HINT_KEY = "menta.milo.hint-seen";

const listeners = new Set<() => void>();

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable: purely cosmetic */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** A number persisted in localStorage (0 on the server and when storage is unavailable). */
function useStoredNumber(key: string): number {
  return useSyncExternalStore(
    subscribe,
    () => readNumber(key),
    () => 0,
  );
}

/** Reveals `text` letter by letter (instantly under reduced motion). */
function useTypewriter(text: string, reduced: boolean) {
  const [state, setState] = useState({ text, count: 0 });
  if (state.text !== text) setState({ text, count: 0 });
  useEffect(() => {
    if (reduced) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setState((s) => (s.text === text ? { text, count: n } : s));
      if (n >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text, reduced]);
  return reduced ? text : text.slice(0, state.text === text ? state.count : 0);
}

/**
 * Milo as companion card on Today: the interactive mascot plus a speech bubble with the
 * coaching nudge. Interacting with Milo swaps in a short reaction line, counts
 * "Streicheleinheiten" (local only) and returns to the nudge afterwards.
 */
export function MascotCoach({ message }: { message: MascotMessage }) {
  const reduced = useReducedMotion() ?? false;
  const [hidden, setHidden] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const pets = useStoredNumber(PETS_KEY);
  const hintSeen = useStoredNumber(HINT_KEY);
  const [mounted, setMounted] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Hint only after hydration (server snapshot is 0 = "not seen" for everyone).
    const id = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(reactionTimer.current);
    };
  }, []);
  const hint = mounted && hintSeen === 0;

  const onReact = useCallback((line: string) => {
    clearTimeout(reactionTimer.current);
    setReaction(line);
    reactionTimer.current = setTimeout(() => setReaction(null), 2400);
    writeNumber(HINT_KEY, 1);
    writeNumber(PETS_KEY, readNumber(PETS_KEY) + 1);
  }, []);

  const text = reaction ?? message.text;
  const typed = useTypewriter(text, reduced);

  if (hidden) return null;
  const dismissible = message.key !== "default";

  return (
    <motion.section
      aria-label="Milo, dein Coach"
      className="relative rounded-card bg-card p-4 shadow-xs"
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      {/* decorative backdrop */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-card">
        <span className="absolute -top-10 -left-10 size-40 rounded-full bg-primary-soft" />
      </span>

      <div className="relative flex items-start gap-3">
        <MiloBuddy mood={message.mood} size={104} onReact={onReact} className="z-10 -mb-1 mt-1" />

        <div className="min-w-0 flex-1 pt-1">
          <div className="relative rounded-2xl rounded-tl-sm bg-surface-inset px-3.5 py-2.5">
            <span aria-hidden className="absolute top-3 -left-2 size-3 rotate-45 bg-surface-inset" />
            {/* full text for assistive tech; the typewriter is visual only */}
            <p className="sr-only" aria-live="polite">
              {text}
            </p>
            {/* the invisible copy reserves the nudge's height so the card never jumps */}
            <p aria-hidden className="relative grid text-body-sm text-foreground">
              <span className="invisible col-start-1 row-start-1">{message.text}</span>
              <span className="col-start-1 row-start-1">
                {typed}
                {typed.length < text.length && (
                  <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-foreground align-middle" />
                )}
              </span>
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {message.action && (
              <Button asChild size="sm">
                <Link href={message.action.href}>{message.action.label}</Link>
              </Button>
            )}
            <AnimatePresence initial={false}>
              {pets > 0 && (
                <motion.span
                  key={pets}
                  initial={reduced ? false : { scale: 1.4 }}
                  animate={{ scale: 1 }}
                  className="inline-flex h-8 items-center gap-1 rounded-full bg-fat-soft px-2.5 text-caption text-fat-strong"
                  title="Streicheleinheiten für Milo"
                >
                  <Heart className="size-3.5 fill-current" aria-hidden />
                  <span className="tabular">{formatNumber(pets)}</span>
                  <span className="sr-only">Streicheleinheiten</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {hint && (
            <p className="mt-2 text-caption text-muted-foreground">Psst: Tipp Milo an, halt ihn gedrückt oder zieh an ihm.</p>
          )}
        </div>

        {dismissible && (
          <button
            type="button"
            aria-label="Hinweis ausblenden"
            className="focus-ring -m-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            onClick={() => {
              setHidden(true);
              void dismissMascotAction(message.key);
            }}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </motion.section>
  );
}
