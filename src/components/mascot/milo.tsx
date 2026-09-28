/**
 * Milo – Menta's mascot. Built from the brand mark (circle whose top-right quarter becomes a
 * leaf point, two ink eyes). Mood is expressed with eyes, mouth and small accents only, so
 * the silhouette stays recognizable from 16 px to 160 px.
 */
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

const LABEL: Record<MiloMood, string> = {
  neutral: "Milo",
  happy: "Milo freut sich",
  celebrating: "Milo feiert",
  thinking: "Milo überlegt",
  sleepy: "Milo ist müde",
  encouraging: "Milo feuert dich an",
  streak: "Milo feiert deine Serie",
  goal_reached: "Milo: Ziel erreicht",
};

const BODY = "M50 0h37.5A12.5 12.5 0 0 1 100 12.5V50A50 50 0 1 1 50 0z";
const INK = "var(--color-foreground, #0B0F0E)";

function Eyes({ mood }: { mood: MiloMood }) {
  const ink = "#0B0F0E";
  switch (mood) {
    case "happy":
    case "celebrating":
    case "goal_reached":
    case "streak":
      // Smiling arcs
      return (
        <g fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round">
          <path d="M36 45q5-7 10 0" />
          <path d="M60 45q5-7 10 0" />
        </g>
      );
    case "sleepy":
      return (
        <g fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round">
          <path d="M36 44q5 5 10 0" />
          <path d="M60 44q5 5 10 0" />
        </g>
      );
    case "thinking":
      return (
        <g fill={ink}>
          <rect x="37" y="36" width="9" height="13" rx="4.5" />
          <rect x="61" y="33" width="9" height="13" rx="4.5" />
        </g>
      );
    default:
      return (
        <g fill={ink} className="milo-eyes">
          <rect x="37" y="36" width="9" height="14" rx="4.5" />
          <rect x="61" y="36" width="9" height="14" rx="4.5" />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: MiloMood }) {
  const ink = "#0B0F0E";
  if (mood === "celebrating" || mood === "goal_reached")
    return <path d="M44 60q9 10 18 0z" fill={ink} />;
  if (mood === "happy" || mood === "encouraging" || mood === "streak")
    return <path d="M45 60q8 7 16 0" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />;
  if (mood === "thinking") return <path d="M47 62h11" stroke={ink} strokeWidth="4" strokeLinecap="round" />;
  if (mood === "sleepy") return <circle cx="53" cy="62" r="3" fill={ink} />;
  return null;
}

function Accent({ mood }: { mood: MiloMood }) {
  switch (mood) {
    case "celebrating":
      return (
        <g className="milo-spark">
          <path d="M8 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="var(--color-kcal, #F59E0B)" />
          <circle cx="94" cy="84" r="4" fill="var(--color-protein, #3B82F6)" />
          <circle cx="12" cy="80" r="3" fill="var(--color-fat, #EC4899)" />
        </g>
      );
    case "streak":
      return <path d="M90 70c6 6 6 16-2 20-8-4-8-12-2-18 0 5 2 6 4-2z" fill="var(--color-kcal, #F59E0B)" />;
    case "goal_reached":
      return (
        <g>
          <circle cx="86" cy="84" r="12" fill="var(--color-success, #16A34A)" />
          <path d="M80 84l4 4 8-8" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "thinking":
      return (
        <g fill={INK} opacity="0.35">
          <circle cx="12" cy="20" r="4" />
          <circle cx="6" cy="8" r="2.5" />
        </g>
      );
    case "sleepy":
      return (
        <text x="80" y="92" fontSize="16" fontWeight="700" fill={INK} opacity="0.4">
          z
        </text>
      );
    case "encouraging":
      return <path d="M88 76l6-6m-2 12h8" stroke="var(--color-primary-strong, #167957)" strokeWidth="3.5" strokeLinecap="round" />;
    default:
      return null;
  }
}

export function Milo({ mood = "neutral", size = 96, animated = true, className, title }: MiloProps) {
  const label = title ?? LABEL[mood];
  const small = size <= 32;
  return (
    <svg
      width={size}
      height={size}
      viewBox="-4 -4 108 108"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={[animated && !small ? "milo-animated" : "", className].filter(Boolean).join(" ")}
      data-mood={mood}
    >
      <g className="milo-body" style={{ transformOrigin: "50px 90px" }}>
        <path d={BODY} fill="var(--color-primary, #1FC98E)" />
        {small ? (
          <path fill="#0B0F0E" d="M37.5 42.7a7.3 7.3 0 0 1 14.6 0v4.2a7.3 7.3 0 0 1-14.6 0zM62.5 42.7a7.3 7.3 0 0 1 14.6 0v4.2a7.3 7.3 0 0 1-14.6 0z" />
        ) : (
          <>
            <Eyes mood={mood} />
            <Mouth mood={mood} />
          </>
        )}
      </g>
      {!small && <Accent mood={mood} />}
    </svg>
  );
}

/** Convenience icon variant (16–32 px). */
export function MiloIcon(props: Omit<MiloProps, "size"> & { size?: number }) {
  return <Milo {...props} size={props.size ?? 24} animated={false} />;
}
