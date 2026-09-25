/**
 * CONTRACT. Props and MiloMood are fixed so other
 * agents can use <Milo /> before the final artwork lands.
 * FOUNDATION STUB: simple placeholder shape – Mascot Design replaces the implementation.
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
  /** Rendered size in px (square). Default 96. Use <= 32 for the icon variant. */
  size?: number;
  /** Enable idle/mood animations (respects prefers-reduced-motion). Default true. */
  animated?: boolean;
  className?: string;
  /** Accessible label; defaults to a mood-specific German description. */
  title?: string;
}

export function Milo({ mood = "neutral", size = 96, className, title }: MiloProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title ?? `Milo (${mood})`}
      className={className}
    >
      <circle cx="50" cy="55" r="38" fill="currentColor" opacity="0.15" />
      <circle cx="38" cy="50" r="5" fill="currentColor" />
      <circle cx="62" cy="50" r="5" fill="currentColor" />
    </svg>
  );
}
