/**
 * Milo: Menta's mascot. Built from the brand mark (circle whose top-right quarter becomes a
 * leaf point, two ink eyes) plus a little sprout, eye shine, cheeks and a soft belly shade.
 * Mood is expressed with eyes, mouth and small accents only, so the silhouette stays
 * recognizable from 16 px to 200 px.
 *
 * The drawing is split into hook-free parts (`MiloBody`, `MiloEyes`, …) that the static
 * `Milo` (usable in Server Components) and the interactive `MiloBuddy` share.
 */
import type { MiloFace } from "./reactions";

export type MiloMood =
  | "neutral"
  | "happy"
  | "celebrating"
  | "thinking"
  | "sleepy"
  | "encouraging"
  | "streak"
  | "goal_reached";

export interface MiloProps {
  mood?: MiloMood;
  /** Rendered size in px (square). Default 96. <= 32 renders the simplified icon variant. */
  size?: number;
  /** Idle blink/breathing animation (disabled for prefers-reduced-motion). Default true. */
  animated?: boolean;
  className?: string;
  /** Accessible label; "" marks Milo as decorative. */
  title?: string;
}

export const MILO_LABEL: Record<MiloMood, string> = {
  neutral: "Milo",
  happy: "Milo freut sich",
  celebrating: "Milo feiert",
  thinking: "Milo überlegt",
  sleepy: "Milo ist müde",
  encouraging: "Milo feuert dich an",
  streak: "Milo feiert deine Serie",
  goal_reached: "Milo: Ziel erreicht",
};

/** Square viewBox with room for the sprout above the body (body spans 0-100). */
export const MILO_VIEWBOX = "-9 -14 118 118";
const ICON_VIEWBOX = "-4 -4 108 108";

const BODY = "M50 0h37.5A12.5 12.5 0 0 1 100 12.5V50A50 50 0 1 1 50 0z";
/** Mascot ink: eyes stay dark on mint in both themes (brand rule). */
export const MILO_INK = "#0B0F0E";
const SHINE = "#FFFFFF";
const INK_SOFT = "var(--color-foreground, #0B0F0E)";

const JOYFUL: readonly MiloMood[] = ["happy", "celebrating", "goal_reached", "streak"];

export function MiloBody() {
  return (
    <g>
      <path d={BODY} fill="var(--color-primary, #1FC98E)" />
      {/* belly shade */}
      <path d="M6 72a50 50 0 0 0 88 0a58 40 0 0 1-88 0z" fill={MILO_INK} opacity="0.08" />
      {/* gloss */}
      <ellipse cx="27" cy="24" rx="12" ry="7" transform="rotate(-35 27 24)" fill={SHINE} opacity="0.32" />
      <circle cx="16" cy="38" r="2.6" fill={SHINE} opacity="0.32" />
    </g>
  );
}

/** Little sprout on Milo's head. Pivot for wiggling: (40, 2). */
export function MiloSprout() {
  return (
    <g>
      <path d="M40 2q-1-7 3-12" fill="none" stroke="var(--color-primary-strong, #167957)" strokeWidth="3" strokeLinecap="round" />
      <path d="M43-10q10-6 17 1q-9 7-17-1z" fill="var(--color-primary, #1FC98E)" stroke="var(--color-primary-strong, #167957)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M33-6q-7-6-13-1q7 6 13 1z" fill="var(--color-primary, #1FC98E)" stroke="var(--color-primary-strong, #167957)" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

function PillEye({ x, y = 36, h = 14 }: { x: number; y?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width="9" height={h} rx="4.5" fill={MILO_INK} />
      <circle cx={x + 3} cy={y + 3.5} r="1.9" fill={SHINE} />
    </g>
  );
}

function heart(cx: number, cy: number, s: number) {
  return `M${cx} ${cy + 4 * s}c-6-4-8-7-8-10a4 4 0 0 1 8-1a4 4 0 0 1 8 1c0 3-2 6-8 10z`;
}

/** Eyes for a mood, or for a temporary interaction face. */
export function MiloEyes({ mood, face = "mood" }: { mood: MiloMood; face?: MiloFace }) {
  const arcs = (d: string) => (
    <g fill="none" stroke={MILO_INK} strokeWidth="5" strokeLinecap="round">
      <path d={`M36 45${d}`} />
      <path d={`M60 45${d}`} />
    </g>
  );
  switch (face) {
    case "surprised":
      return (
        <g>
          <circle cx="41.5" cy="42" r="7" fill={MILO_INK} />
          <circle cx="65.5" cy="42" r="7" fill={MILO_INK} />
          <circle cx="39" cy="39.5" r="2.4" fill={SHINE} />
          <circle cx="63" cy="39.5" r="2.4" fill={SHINE} />
        </g>
      );
    case "squint":
      return arcs("q5-8 10 0");
    case "love":
      return (
        <g fill="var(--color-fat, #EC4899)" stroke={MILO_INK} strokeWidth="1.5">
          <path d={heart(41.5, 38, 1)} />
          <path d={heart(65.5, 38, 1)} />
        </g>
      );
    case "dizzy":
      return (
        <g fill="none" stroke={MILO_INK} strokeWidth="3" strokeLinecap="round">
          <path d="M41.5 43m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-6 0a5 5 0 1 1 10 0" />
          <path d="M65.5 43m-1 0a1 1 0 1 1 2 0a3 3 0 1 1-6 0a5 5 0 1 1 10 0" />
        </g>
      );
    case "wink":
      return (
        <g>
          <PillEye x={37} />
          <path d="M60 45q5-7 10 0" fill="none" stroke={MILO_INK} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case "charging":
      return (
        <g fill="none" stroke={MILO_INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M36 37l9 6-9 6" />
          <path d="M71 37l-9 6 9 6" />
        </g>
      );
    case "mood":
      break;
  }
  if (JOYFUL.includes(mood)) return arcs("q5-7 10 0");
  if (mood === "sleepy") return arcs("q5 5 10 0");
  if (mood === "thinking")
    return (
      <g>
        <PillEye x={37} y={36} h={13} />
        <PillEye x={61} y={33} h={13} />
      </g>
    );
  return (
    <g>
      <PillEye x={37} />
      <PillEye x={61} />
    </g>
  );
}

export function MiloMouth({ mood, face = "mood" }: { mood: MiloMood; face?: MiloFace }) {
  const smile = <path d="M45 60q8 7 16 0" fill="none" stroke={MILO_INK} strokeWidth="4" strokeLinecap="round" />;
  const grin = (
    <g>
      <path d="M43 59q10 13 20 0z" fill={MILO_INK} />
      <path d="M48 64.5q5 3 10 0q-2 3.5-5 3.5t-5-3.5z" fill="var(--color-fat, #EC4899)" />
    </g>
  );
  switch (face) {
    case "surprised":
      return <ellipse cx="53" cy="63" rx="4.5" ry="5.5" fill={MILO_INK} />;
    case "squint":
    case "love":
      return grin;
    case "dizzy":
      return <path d="M44 62q3-3 6 0t6 0t6 0" fill="none" stroke={MILO_INK} strokeWidth="3.5" strokeLinecap="round" />;
    case "wink":
      return (
        <g>
          {smile}
          <path d="M55 63q3 5 6 0" fill="var(--color-fat, #EC4899)" />
        </g>
      );
    case "charging":
      return <rect x="44" y="58" width="18" height="7" rx="3.5" fill={MILO_INK} />;
    case "mood":
      break;
  }
  if (mood === "celebrating" || mood === "goal_reached") return grin;
  if (mood === "happy" || mood === "encouraging" || mood === "streak") return smile;
  if (mood === "thinking") return <path d="M47 62h11" stroke={MILO_INK} strokeWidth="4" strokeLinecap="round" />;
  if (mood === "sleepy") return <circle cx="53" cy="62" r="3" fill={MILO_INK} />;
  return <path d="M48 60q5 4 10 0" fill="none" stroke={MILO_INK} strokeWidth="3.5" strokeLinecap="round" />;
}

export function MiloCheeks({ mood, face = "mood" }: { mood: MiloMood; face?: MiloFace }) {
  const show = face === "love" || face === "squint" || face === "wink" || (face === "mood" && (JOYFUL.includes(mood) || mood === "encouraging"));
  if (!show) return null;
  return (
    <g fill="#FF94B0" opacity="0.9">
      <ellipse cx="29" cy="56" rx="6" ry="3.5" />
      <ellipse cx="80" cy="56" rx="6" ry="3.5" />
    </g>
  );
}

export function MiloAccent({ mood }: { mood: MiloMood }) {
  switch (mood) {
    case "celebrating":
      return (
        <g className="milo-spark">
          <path d="M2 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="var(--color-kcal, #F59E0B)" />
          <circle cx="98" cy="84" r="4" fill="var(--color-protein, #3B82F6)" />
          <circle cx="6" cy="84" r="3" fill="var(--color-fat, #EC4899)" />
        </g>
      );
    case "streak":
      return (
        <g className="milo-flame">
          <path d="M92 66c7 7 7 19-2 23-9-5-9-14-2-21 0 6 2 7 4-2z" fill="var(--color-kcal, #F59E0B)" />
          <path d="M90 78c3 3 3 8-1 10-4-2-4-6-1-9 0 2 1 3 2-1z" fill="var(--color-carbs, #FBBF24)" />
        </g>
      );
    case "goal_reached":
      return (
        <g className="milo-spark">
          <circle cx="88" cy="86" r="12" fill="var(--color-success, #16A34A)" />
          <path d="M82 86l4 4 8-8" fill="none" stroke={SHINE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "thinking":
      return (
        <g fill={INK_SOFT} opacity="0.35">
          <circle cx="4" cy="22" r="4" />
          <circle cx="-3" cy="10" r="2.5" />
        </g>
      );
    case "sleepy":
      return (
        <text x="84" y="96" fontSize="16" fontWeight="700" fill={INK_SOFT} opacity="0.4">
          z
        </text>
      );
    case "encouraging":
      return <path d="M90 76l6-6m-2 12h8" stroke="var(--color-primary-strong, #167957)" strokeWidth="3.5" strokeLinecap="round" />;
    default:
      return null;
  }
}

export function Milo({ mood = "neutral", size = 96, animated = true, className, title }: MiloProps) {
  const label = title ?? MILO_LABEL[mood];
  const small = size <= 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox={small ? ICON_VIEWBOX : MILO_VIEWBOX}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={[animated && !small ? "milo-animated" : "", className].filter(Boolean).join(" ")}
      data-mood={mood}
      overflow="visible"
    >
      <g className="milo-body" style={{ transformOrigin: "50px 98px" }}>
        {small ? (
          <>
            <path d={BODY} fill="var(--color-primary, #1FC98E)" />
            <path fill={MILO_INK} d="M37.5 42.7a7.3 7.3 0 0 1 14.6 0v4.2a7.3 7.3 0 0 1-14.6 0zM62.5 42.7a7.3 7.3 0 0 1 14.6 0v4.2a7.3 7.3 0 0 1-14.6 0z" />
          </>
        ) : (
          <>
            <g className="milo-sprout" style={{ transformOrigin: "40px 2px" }}>
              <MiloSprout />
            </g>
            <MiloBody />
            <MiloCheeks mood={mood} />
            <g className="milo-eyes">
              <MiloEyes mood={mood} />
            </g>
            <MiloMouth mood={mood} />
          </>
        )}
      </g>
      {!small && <MiloAccent mood={mood} />}
    </svg>
  );
}

/** Convenience icon variant (16-32 px). */
export function MiloIcon(props: Omit<MiloProps, "size"> & { size?: number }) {
  return <Milo {...props} size={props.size ?? 24} animated={false} />;
}
