"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Music } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MILO_LABEL,
  MILO_VIEWBOX,
  MiloAccent,
  MiloBody,
  MiloCheeks,
  MiloEyes,
  MiloMouth,
  MiloSprout,
  type MiloMood,
} from "./milo";
import {
  addPetting,
  gazeTowards,
  LONG_PRESS_MS,
  nextDelay,
  pickIdle,
  pickLine,
  pickTapReaction,
  REACTIONS,
  registerTap,
  type MiloFace,
  type MiloReaction,
  type ParticleKind,
} from "./reactions";

export interface MiloBuddyProps {
  mood?: MiloMood;
  /** Rendered size in px. Default 112. */
  size?: number;
  className?: string;
  /** Allow dragging Milo around (he springs back). Default true. */
  draggable?: boolean;
  /** Called whenever Milo reacts to the user: e.g. to show the line in a speech bubble. */
  onReact?: (line: string, reaction: MiloReaction) => void;
}

interface Particle {
  id: number;
  kind: ParticleKind;
  dx: number;
  dy: number;
  rotate: number;
  delay: number;
  tone: number;
}

const CONFETTI_TONES = ["bg-protein", "bg-carbs", "bg-fat", "bg-kcal", "bg-primary", "bg-water"] as const;
const SPARKLE_TONES = ["text-kcal", "text-carbs", "text-primary", "text-protein"] as const;
const MAX_PARTICLES = 48;

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/**
 * Milo as an interactive companion. Everything is optional sugar on top of the static art:
 * - eyes follow the pointer / last touch, random (double) blinks, breathing, swaying sprout
 * - tap → hop / wiggle / spin / giggle / love (never twice in a row), double tap → salto,
 *   6 quick taps → dizzy, long press → charge up + confetti, drag → "Wuiii!" + spring back,
 *   stroking him with the mouse → heart eyes
 * - idle behaviours (look around, hop, hum, yawn …) and mood loops (Zzz, confetti, flame)
 * Under prefers-reduced-motion only the face and the speech line change.
 */
export function MiloBuddy({ mood = "neutral", size = 112, className, draggable = true, onReact }: MiloBuddyProps) {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLButtonElement>(null);

  const [face, setFace] = useState<MiloFace>("mood");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [charging, setCharging] = useState(false);

  // Body choreography
  const bodyY = useMotionValue(0);
  const bodyX = useMotionValue(0);
  const bodyR = useMotionValue(0);
  const bodySX = useMotionValue(1);
  const bodySY = useMotionValue(1);
  const sproutR = useMotionValue(0);
  const shadowScale = useTransform(bodyY, [-70, 0], [0.45, 1]);
  const shadowOpacity = useTransform(bodyY, [-70, 0], [0.08, 0.2]);

  // Gaze (-1 … 1) → springy eye offset in viewBox units
  const gazeX = useMotionValue(0);
  const gazeY = useMotionValue(0);
  const eyeX = useSpring(useTransform(gazeX, (g) => g * 4), { stiffness: 260, damping: 20 });
  const eyeY = useSpring(useTransform(gazeY, (g) => g * 3), { stiffness: 260, damping: 20 });
  const mouthX = useTransform(eyeX, (x) => x * 0.5);
  const blink = useMotionValue(1);

  const busyUntil = useRef(0);
  const faceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressFired = useRef(false);
  const taps = useRef<number[]>([]);
  const lastReaction = useRef<MiloReaction | null>(null);
  const lastPointer = useRef(0);
  const petting = useRef(0);
  const nextId = useRef(0);
  const chargeAnim = useRef<{ stop: () => void } | null>(null);

  // ── Particles ───────────────────────────────────────────────────────────
  const emit = useCallback(
    (kind: ParticleKind, count: number) => {
      if (reduced) return;
      const spread = size * (kind === "confetti" ? 1.1 : 0.75);
      const fresh: Particle[] = Array.from({ length: count }, (_, i) => {
        const angle =
          kind === "zzz" || kind === "note" || kind === "bubble"
            ? -Math.PI / 2 + (Math.random() - 0.2) * 0.9
            : -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        const dist = spread * (0.55 + Math.random() * 0.6);
        return {
          id: nextId.current++,
          kind,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          rotate: (Math.random() - 0.5) * 540,
          delay: kind === "zzz" ? i * 0.35 : Math.random() * 0.12,
          tone: Math.floor(Math.random() * 6),
        };
      });
      setParticles((p) => [...p, ...fresh].slice(-MAX_PARTICLES));
    },
    [reduced, size],
  );

  const removeParticle = useCallback((id: number) => setParticles((p) => p.filter((x) => x.id !== id)), []);

  // ── Face helpers ────────────────────────────────────────────────────────
  const showFace = useCallback((f: MiloFace, ms: number) => {
    clearTimeout(faceTimer.current);
    setFace(f);
    faceTimer.current = setTimeout(() => setFace("mood"), ms);
  }, []);

  const doBlink = useCallback(
    (twice = false) => {
      if (reduced) return;
      void animate(blink, twice ? [1, 0.1, 1, 0.1, 1] : [1, 0.1, 1], { duration: twice ? 0.36 : 0.18 });
    },
    [blink, reduced],
  );

  // ── Choreography ────────────────────────────────────────────────────────
  const hop = useCallback(
    (height = 34, duration = 0.6) => {
      const times = [0, 0.15, 0.45, 0.8, 1];
      void animate(bodySY, [1, 0.8, 1.12, 0.92, 1], { duration, times });
      void animate(bodySX, [1, 1.16, 0.9, 1.08, 1], { duration, times });
      void animate(bodyY, [0, 4, -height, 0, 0], { duration, times, ease: "easeOut" });
    },
    [bodySX, bodySY, bodyY],
  );

  const wiggle = useCallback(
    (amount = 14) => {
      void animate(bodyR, [0, -amount, amount * 0.85, -amount * 0.6, amount * 0.4, 0], { duration: 0.7 });
      void animate(sproutR, [0, 30, -28, 20, -10, 0], { duration: 0.8 });
    },
    [bodyR, sproutR],
  );

  const play = useCallback(
    (reaction: MiloReaction) => {
      switch (reaction) {
        case "hop":
        case "wee":
          hop(reaction === "wee" ? 46 : 34);
          break;
        case "wiggle":
          wiggle();
          break;
        case "spin":
          hop(26, 0.7);
          void animate(bodyR, [0, 360], { duration: 0.7, ease: "easeInOut" }).then(() => bodyR.jump(0));
          break;
        case "giggle":
          void animate(bodyX, [0, -5, 5, -5, 5, -3, 3, 0], { duration: 0.6 });
          void animate(bodySY, [1, 0.95, 1.04, 0.95, 1.03, 1], { duration: 0.6 });
          break;
        case "love":
          void animate(bodySX, [1, 1.08, 1, 1.08, 1], { duration: 0.9 });
          void animate(bodySY, [1, 1.08, 1, 1.08, 1], { duration: 0.9 });
          void animate(bodyR, [0, -6, 6, 0], { duration: 0.9 });
          break;
        case "flip":
          void animate(bodyY, [0, 6, -64, 0], { duration: 0.8, times: [0, 0.12, 0.5, 1], ease: "easeOut" });
          void animate(bodyR, [0, -360], { duration: 0.8, ease: [0.5, 0, 0.3, 1] }).then(() => bodyR.jump(0));
          void animate(bodySY, [1, 0.8, 1.1, 0.85, 1], { duration: 0.8 });
          break;
        case "dizzy":
          void animate(bodyR, [0, -12, 12, -10, 10, -6, 6, 0], { duration: 2, ease: "easeInOut" });
          void animate(bodyX, [0, 8, -8, 6, -6, 0], { duration: 2, ease: "easeInOut" });
          break;
        case "powerup":
          void animate(bodySX, [1.18, 0.85, 1.12, 1], { duration: 0.6 });
          void animate(bodySY, [1.18, 1.25, 0.9, 1], { duration: 0.6 });
          void animate(bodyY, [0, -40, 0], { duration: 0.6, ease: "easeOut" });
          wiggle(8);
          break;
      }
    },
    [bodyR, bodySX, bodySY, bodyX, bodyY, hop, wiggle],
  );

  const react = useCallback(
    (reaction: MiloReaction) => {
      const spec = REACTIONS[reaction];
      lastReaction.current = reaction;
      busyUntil.current = Date.now() + spec.durationMs;
      showFace(spec.face === "charging" ? "squint" : spec.face, spec.durationMs);
      if (!reduced) play(reaction);
      if (spec.particles) emit(spec.particles.kind, spec.particles.count);
      if (reaction === "powerup" || reaction === "flip") emit("sparkle", 6);
      vibrate(reaction === "powerup" ? 30 : 8);
      onReact?.(pickLine(reaction, Math.random), reaction);
    },
    [emit, onReact, play, reduced, showFace],
  );

  // ── Pointer gaze ────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      lastPointer.current = Date.now();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const g = gazeTowards({ x: r.left + r.width / 2, y: r.top + r.height * 0.45 }, { x: e.clientX, y: e.clientY });
        gazeX.set(g.x);
        gazeY.set(g.y);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    };
  }, [gazeX, gazeY, reduced]);

  // ── Idle life: blinking, sprout sway, idle behaviours, mood loops ───────
  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let alive = true;
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));

    const blinkLoop = () => {
      if (mood !== "sleepy") doBlink(Math.random() < 0.2);
      later(blinkLoop, nextDelay(2400, 5600, Math.random));
    };
    later(blinkLoop, 1500);

    const sway = animate(sproutR, [-6, 7, -6], { duration: mood === "sleepy" ? 4.5 : 2.8, repeat: Infinity, ease: "easeInOut" });

    const lookAround = () => {
      const points = [
        [-0.9, -0.2],
        [0.8, -0.5],
        [0.2, 0.6],
        [0, 0],
      ] as const;
      points.forEach(([x, y], i) =>
        later(() => {
          if (Date.now() - lastPointer.current < 2500) return;
          gazeX.set(x);
          gazeY.set(y);
        }, i * 650),
      );
    };

    const idleLoop = () => {
      if (Date.now() > busyUntil.current) {
        switch (pickIdle(mood, Math.random)) {
          case "lookAround":
            lookAround();
            break;
          case "hop":
            hop(16, 0.5);
            break;
          case "wiggle":
            wiggle(7);
            break;
          case "sparkle":
            emit("sparkle", 3);
            break;
          case "hum":
            emit("note", 2);
            void animate(bodyR, [0, -4, 4, -4, 0], { duration: 1.2 });
            break;
          case "yawn":
            showFace("surprised", 1200);
            void animate(bodySY, [1, 1.1, 1.1, 1], { duration: 1.2 });
            emit("zzz", 3);
            break;
        }
      }
      later(idleLoop, nextDelay(6000, 11000, Math.random));
    };
    later(idleLoop, nextDelay(2500, 5000, Math.random));

    if (mood === "sleepy") {
      const zzz = () => {
        if (Date.now() > busyUntil.current) emit("zzz", 1);
        later(zzz, 2600);
      };
      later(zzz, 600);
    }
    if (mood === "celebrating" || mood === "goal_reached" || mood === "streak") {
      later(() => {
        hop(30);
        emit("confetti", mood === "streak" ? 10 : 18);
      }, 500);
    }

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      sway.stop();
    };
  }, [bodyR, bodySY, doBlink, emit, gazeX, gazeY, hop, mood, reduced, showFace, sproutR, wiggle]);

  useEffect(
    () => () => {
      clearTimeout(faceTimer.current);
      clearTimeout(pressTimer.current);
      chargeAnim.current?.stop();
    },
    [],
  );

  // ── Gestures ────────────────────────────────────────────────────────────
  const stopCharging = useCallback(() => {
    clearTimeout(pressTimer.current);
    chargeAnim.current?.stop();
    chargeAnim.current = null;
    setCharging(false);
  }, []);

  const onTapStart = useCallback(() => {
    longPressFired.current = false;
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      // Hold → charge up …
      setCharging(true);
      showFace("charging", 4000);
      vibrate(12);
      if (!reduced) {
        void animate(bodySX, 1.14, { duration: 0.6 });
        void animate(bodySY, 0.9, { duration: 0.6 });
        chargeAnim.current = animate(bodyX, [0, -2.5, 2.5, 0], { duration: 0.12, repeat: Infinity });
      }
      // … and release automatically after a moment
      pressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        stopCharging();
        bodyX.jump(0);
        react("powerup");
      }, 700);
    }, LONG_PRESS_MS);
  }, [bodySX, bodySY, bodyX, react, reduced, showFace, stopCharging]);

  const onTap = useCallback(() => {
    const wasCharging = charging;
    stopCharging();
    if (longPressFired.current) return;
    if (wasCharging) {
      bodyX.jump(0);
      react("powerup");
      return;
    }
    const now = Date.now();
    taps.current = registerTap(taps.current, now);
    const reaction = pickTapReaction(taps.current, lastReaction.current, Math.random);
    if (reaction === "dizzy") taps.current = [];
    react(reaction);
  }, [bodyX, charging, react, stopCharging]);

  const onTapCancel = useCallback(() => {
    stopCharging();
    if (!reduced) {
      void animate(bodySX, 1, { duration: 0.2 });
      void animate(bodySY, 1, { duration: 0.2 });
    }
  }, [bodySX, bodySY, reduced, stopCharging]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0 || Date.now() < busyUntil.current) return;
      // cap per event so a single pointer jump onto Milo doesn't count as stroking
      const res = addPetting(petting.current, Math.min(30, Math.abs(e.movementX) + Math.abs(e.movementY)));
      petting.current = res.total;
      if (res.triggered) react("love");
    },
    [react],
  );

  const label = `${MILO_LABEL[mood]}. Antippen, gedrückt halten oder ziehen`;

  return (
    <motion.button
      ref={rootRef}
      type="button"
      aria-label={label}
      data-mood={mood}
      data-face={face}
      className={cn(
        "focus-ring relative shrink-0 cursor-grab select-none rounded-full active:cursor-grabbing",
        draggable && !reduced && "touch-none",
        className,
      )}
      style={{ width: size, height: size }}
      drag={draggable && !reduced}
      dragSnapToOrigin
      dragElastic={0.55}
      dragTransition={{ bounceStiffness: 420, bounceDamping: 14 }}
      whileDrag={{ scale: 1.08, rotate: -8, zIndex: 50 }}
      onDragStart={() => {
        stopCharging();
        longPressFired.current = true; // a drag is not a tap
        showFace("surprised", 4000);
      }}
      onDragEnd={() => react("wee")}
      onTapStart={onTapStart}
      onTap={onTap}
      onTapCancel={onTapCancel}
      onPointerMove={onPointerMove}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          onTap();
        }
      }}
    >
      {/* ground shadow */}
      <motion.span
        aria-hidden
        className="absolute bottom-0 left-1/2 h-[9%] w-[62%] -translate-x-1/2 rounded-[50%] bg-foreground"
        style={{ scaleX: shadowScale, opacity: shadowOpacity }}
      />

      {/* charging aura */}
      <AnimatePresence>
        {charging && (
          <motion.span
            aria-hidden
            className="absolute inset-[6%] rounded-full border-4 border-kcal"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.9, 0.3, 0.9] }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      <motion.span
        aria-hidden
        className="absolute inset-0 block"
        style={{ x: bodyX, y: bodyY, rotate: bodyR, scaleX: bodySX, scaleY: bodySY, originX: 0.5, originY: 0.92 }}
      >
        <motion.span
          className="block size-full"
          animate={reduced ? undefined : { scaleX: [1, 1.025, 1], scaleY: [1, 0.975, 1] }}
          transition={{ duration: mood === "sleepy" ? 5 : 3.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ originY: 0.92 }}
        >
          <svg viewBox={MILO_VIEWBOX} width="100%" height="100%" overflow="visible" className="milo-animated">
            <motion.g style={{ rotate: sproutR, originX: 0.5, originY: 1 }}>
              <MiloSprout />
            </motion.g>
            <MiloBody />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.g key={face} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <MiloCheeks mood={mood} face={face} />
              </motion.g>
            </AnimatePresence>
            <motion.g style={{ x: eyeX, y: eyeY, scaleY: blink, originY: 0.5 }}>
              <motion.g
                key={face}
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                <MiloEyes mood={mood} face={face} />
              </motion.g>
            </motion.g>
            <motion.g style={{ x: mouthX }}>
              <MiloMouth mood={mood} face={face} />
            </motion.g>
            <MiloAccent mood={mood} />
          </svg>
        </motion.span>
      </motion.span>

      {/* particles */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <AnimatePresence>
          {particles.map((p) => (
            <ParticleView key={p.id} p={p} size={size} onDone={removeParticle} />
          ))}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

function ParticleView({ p, size, onDone }: { p: Particle; size: number; onDone: (id: number) => void }) {
  const s = Math.max(10, Math.round(size * 0.14));
  const origin = p.kind === "zzz" || p.kind === "note" ? { left: "72%", top: "18%" } : { left: "50%", top: "45%" };
  const gravity = p.kind === "confetti" ? size * 0.5 : 0;
  return (
    <motion.span
      className="absolute flex items-center justify-center"
      style={{ ...origin, width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }}
      initial={{ x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }}
      animate={{
        x: p.kind === "zzz" ? [0, p.dx * 0.3, p.dx * 0.15 + 8] : [0, p.dx],
        y: gravity ? [0, p.dy, p.dy + gravity] : [0, p.dy],
        scale: p.kind === "zzz" ? [0.4, 1, 1.3] : [0.2, 1.1, 0.8],
        opacity: [0, 1, 0],
        rotate: p.kind === "confetti" || p.kind === "sparkle" || p.kind === "leaf" ? p.rotate : 0,
      }}
      transition={{ duration: p.kind === "zzz" ? 2 : p.kind === "confetti" ? 1.4 : 1, delay: p.delay, ease: "easeOut" }}
      onAnimationComplete={() => onDone(p.id)}
    >
      <ParticleShape kind={p.kind} tone={p.tone} />
    </motion.span>
  );
}

function ParticleShape({ kind, tone }: { kind: ParticleKind; tone: number }) {
  switch (kind) {
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className="size-full text-fat">
          <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 5 6.6 5c2.1 0 3.6 1.2 5.4 3.1C13.8 6.2 15.3 5 17.4 5 21 5 23.1 8.6 21.6 11.9 19.5 16.4 12 21 12 21z" />
        </svg>
      );
    case "sparkle":
      return (
        <svg viewBox="0 0 24 24" className={cn("size-full", SPARKLE_TONES[tone % SPARKLE_TONES.length])}>
          <path fill="currentColor" d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
        </svg>
      );
    case "confetti":
      return <span className={cn("block h-[70%] w-[38%] rounded-[2px]", CONFETTI_TONES[tone % CONFETTI_TONES.length])} />;
    case "leaf":
      return (
        <svg viewBox="0 0 24 24" className="size-full text-primary">
          <path fill="currentColor" d="M4 20C4 9 11 3 21 3c0 10-6 17-17 17z" />
        </svg>
      );
    case "zzz":
      return <span className="text-body-sm font-bold text-muted-foreground">z</span>;
    case "note":
      return <Music className="size-full text-protein" strokeWidth={2.5} />;
    case "bubble":
      return <span className="block size-[70%] rounded-full border-2 border-muted-foreground/40" />;
  }
}
