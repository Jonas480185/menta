/**
 * Desktop keyboard shortcuts – pure mapping so it can be unit tested.
 * Single keys without modifiers (like Gmail/Linear), ignored while typing in a field.
 */

export type ShortcutAction =
  | { type: "navigate"; href: string }
  | { type: "search" }
  | { type: "help" };

export interface ShortcutDef {
  keys: readonly string[];
  label: string;
  action: ShortcutAction;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { keys: ["n"], label: "Essen loggen", action: { type: "navigate", href: "/log" } },
  { keys: ["/"], label: "Lebensmittel suchen", action: { type: "search" } },
  { keys: ["1"], label: "Heute", action: { type: "navigate", href: "/today" } },
  { keys: ["2"], label: "Tagebuch", action: { type: "navigate", href: "/diary" } },
  { keys: ["3"], label: "Fortschritt", action: { type: "navigate", href: "/progress" } },
  { keys: ["4"], label: "Profil & Einstellungen", action: { type: "navigate", href: "/settings" } },
  { keys: ["w"], label: "Wasser & Aktivität", action: { type: "navigate", href: "/activity" } },
  { keys: ["g"], label: "Gewicht", action: { type: "navigate", href: "/progress/weight" } },
  { keys: ["?"], label: "Tastenkürzel anzeigen", action: { type: "help" } },
];

/** Shortcut key shown in the sidebar for a nav href, if any. */
export function shortcutFor(href: string): string | undefined {
  return SHORTCUTS.find((s) => s.action.type === "navigate" && s.action.href === href)?.keys[0];
}

export interface KeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  /** True while focus is in an input, textarea, select or contenteditable. */
  typing: boolean;
}

/** Resolves a keydown to an action. ⌘K / Ctrl+K also opens the search, even while typing. */
export function resolveShortcut(e: KeyInput): ShortcutAction | null {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") return { type: "search" };
  if (e.typing || e.metaKey || e.ctrlKey || e.altKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return SHORTCUTS.find((s) => s.keys.includes(key))?.action ?? null;
}
