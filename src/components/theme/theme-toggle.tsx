"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { THEMES, useTheme, type ThemePreference } from "./theme-provider";

const OPTIONS: Record<ThemePreference, { label: string; icon: LucideIcon }> = {
  light: { label: "Hell", icon: Sun },
  dark: { label: "Dunkel", icon: Moon },
  system: { label: "System", icon: Monitor },
};

const subscribeNoop = () => () => {};

/** true after hydration: the stored theme is unknown on the server. */
function useMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export interface ThemeToggleProps {
  /** Hide text labels (icons stay, labels move to aria-label). Default: labels shown. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Light / Dark / System segmented control.
 * ARIA radiogroup with roving tabindex: Tab focuses the group, arrow keys move + select.
 * Each segment is ≥ 44 px tall.
 */
export function ThemeToggle({ iconOnly = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active: ThemePreference | undefined = mounted ? theme : undefined;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = THEMES.length - 1;
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    setTheme(THEMES[target]!);
    refs.current[target]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className={cn(
        "bg-surface-inset inline-flex gap-1 rounded-[calc(var(--radius-md)+4px)] p-1",
        className,
      )}
    >
      {THEMES.map((value, index) => {
        const { label, icon: Icon } = OPTIONS[value];
        const checked = active === value;
        // Before mount no option is known; keep "system" focusable so the group stays reachable.
        const tabbable = active ? checked : value === "system";
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => setTheme(value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "text-muted-foreground inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3",
              "text-body-sm font-medium transition-[background-color,color,box-shadow] duration-150",
              "hover:text-foreground",
              "aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm",
              "dark:aria-checked:bg-surface-3",
            )}
          >
            <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
            {!iconOnly && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
