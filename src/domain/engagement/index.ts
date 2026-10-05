/**
 * Engagement domain: streaks, achievements and Milo's coaching rules.
 * Pure and deterministic (ISO date strings, no Math.random): safe for SSR and tests.
 */

export type MiloMoodKey =
  | "neutral"
  | "happy"
  | "celebrating"
  | "thinking"
  | "sleepy"
  | "encouraging"
  | "streak"
  | "goal_reached";

// ── Streaks ────────────────────────────────────────────────────────────────

function prevDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export interface Streak {
  current: number;
  longest: number;
  todayLogged: boolean;
}

/** Today not yet logged does not break the streak: it counts through yesterday. */
export function computeStreak(loggedDates: readonly string[], today: string): Streak {
  const set = new Set(loggedDates);
  const todayLogged = set.has(today);
  let current = 0;
  for (let d = todayLogged ? today : prevDay(today); set.has(d); d = prevDay(d)) current++;
  const sorted = [...set].filter((d) => d <= today).sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && prevDay(sorted[i]) === sorted[i - 1] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest, todayLogged };
}

/** Share of the last `window` days (incl. today) with at least one entry, 0-100. */
export function consistencyScore(loggedDates: readonly string[], today: string, window = 28): number {
  const set = new Set(loggedDates);
  let hits = 0;
  for (let i = 0, d = today; i < window; i++, d = prevDay(d)) if (set.has(d)) hits++;
  return Math.round((hits / window) * 100);
}

// ── Achievements ───────────────────────────────────────────────────────────

export interface AchievementFacts {
  totalEntries: number;
  longestStreak: number;
  customFoods: number;
  recipes: number;
  weightEntries: number;
  proteinGoalDays: number;
  waterGoalDays: number;
  consistency: number;
}

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked: (f: AchievementFacts) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { key: "first_entry", title: "Der Anfang", description: "Erstes Lebensmittel geloggt.", icon: "sprout", unlocked: (f) => f.totalEntries >= 1 },
  { key: "streak_3", title: "Drei am Stück", description: "3 Tage in Folge geloggt.", icon: "flame", unlocked: (f) => f.longestStreak >= 3 },
  { key: "streak_7", title: "Eine Woche", description: "7 Tage in Folge geloggt.", icon: "flame", unlocked: (f) => f.longestStreak >= 7 },
  { key: "streak_30", title: "Ein Monat", description: "30 Tage in Folge geloggt.", icon: "calendar-check", unlocked: (f) => f.longestStreak >= 30 },
  { key: "streak_100", title: "Hundert Tage", description: "100 Tage in Folge geloggt.", icon: "trophy", unlocked: (f) => f.longestStreak >= 100 },
  { key: "entries_100", title: "Gut sortiert", description: "100 Einträge geloggt.", icon: "list-checks", unlocked: (f) => f.totalEntries >= 100 },
  { key: "first_custom_food", title: "Eigene Küche", description: "Erstes eigenes Lebensmittel angelegt.", icon: "chef-hat", unlocked: (f) => f.customFoods >= 1 },
  { key: "first_recipe", title: "Rezeptbuch", description: "Erstes Rezept gespeichert.", icon: "book-open", unlocked: (f) => f.recipes >= 1 },
  { key: "first_weight", title: "Startpunkt", description: "Erstes Gewicht eingetragen.", icon: "scale", unlocked: (f) => f.weightEntries >= 1 },
  { key: "weight_10", title: "Trend im Blick", description: "10 Gewichtseinträge.", icon: "chart-line", unlocked: (f) => f.weightEntries >= 10 },
  { key: "protein_5", title: "Proteinprofi", description: "An 5 Tagen das Protein-Ziel erreicht.", icon: "beef", unlocked: (f) => f.proteinGoalDays >= 5 },
  { key: "water_7", title: "Gut hydriert", description: "An 7 Tagen das Wasserziel erreicht.", icon: "droplets", unlocked: (f) => f.waterGoalDays >= 7 },
  { key: "consistency_80", title: "Beständig", description: "80 % der letzten 4 Wochen geloggt.", icon: "badge-check", unlocked: (f) => f.consistency >= 80 },
];

export function evaluateAchievementRules(facts: AchievementFacts, unlocked: ReadonlySet<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.key) && a.unlocked(facts)).map((a) => a.key);
}

// ── Milo coaching rules ────────────────────────────────────────────────────

export interface MascotContext {
  hour: number;
  isNewUser: boolean;
  entryCount: number;
  emptyMeals: { id: string; name: string }[];
  consumedKcal: number;
  targetKcal: number | null;
  proteinG: number;
  proteinTarget: number | null;
  waterMl: number;
  waterGoalMl: number;
  streak: Streak;
  weightDirection: "towards" | "away" | "stable" | null;
  daysSinceWeight: number | null;
  newAchievement: string | null;
  dismissedKeys: readonly string[];
}

export interface MascotMessage {
  key: string;
  mood: MiloMoodKey;
  text: string;
  action?: { label: string; href: string };
}

type Rule = { key: string; applies: (c: MascotContext) => boolean; build: (c: MascotContext) => MascotMessage };

const mealNamed = (c: MascotContext, re: RegExp) => c.emptyMeals.find((m) => re.test(m.name));
const logHref = (mealId?: string) => (mealId ? `/log?meal=${mealId}` : "/log");

/** Ordered by priority: the first applicable, non-dismissed rule wins. */
export const MASCOT_RULES: readonly Rule[] = [
  {
    key: "achievement",
    applies: (c) => !!c.newAchievement,
    build: (c) => ({ key: "achievement", mood: "celebrating", text: `Neuer Erfolg: ${c.newAchievement}.`, action: { label: "Ansehen", href: "/achievements" } }),
  },
  {
    key: "welcome",
    applies: (c) => c.isNewUser && c.entryCount === 0,
    build: () => ({ key: "welcome", mood: "happy", text: "Hi, ich bin Milo. Logge dein erstes Essen, ich halte den Überblick.", action: { label: "Loslegen", href: "/log" } }),
  },
  {
    key: "streak_milestone",
    applies: (c) => c.streak.todayLogged && [3, 7, 14, 30, 50, 100].includes(c.streak.current),
    build: (c) => ({ key: "streak_milestone", mood: "streak", text: `${c.streak.current} Tage in Folge geloggt.` }),
  },
  {
    key: "protein_reached",
    applies: (c) => !!c.proteinTarget && c.proteinG >= c.proteinTarget,
    build: () => ({ key: "protein_reached", mood: "goal_reached", text: "Protein-Ziel erreicht." }),
  },
  {
    key: "morning_empty",
    applies: (c) => c.hour >= 5 && c.hour < 11 && c.entryCount === 0,
    build: (c) => ({ key: "morning_empty", mood: "encouraging", text: "Noch nichts geloggt. Was gab es zum Frühstück?", action: { label: "Frühstück loggen", href: logHref(mealNamed(c, /früh/i)?.id) } }),
  },
  {
    key: "lunch_empty",
    applies: (c) => c.hour >= 13 && c.hour < 16 && !!mealNamed(c, /mittag/i),
    build: (c) => ({ key: "lunch_empty", mood: "thinking", text: "Mittagessen schon gehabt? Mit zwei Tipps ist es eingetragen.", action: { label: "Mittagessen loggen", href: logHref(mealNamed(c, /mittag/i)?.id) } }),
  },
  {
    key: "dinner_empty",
    applies: (c) => c.hour >= 19 && c.hour < 23 && !!mealNamed(c, /abend/i) && c.entryCount > 0,
    build: (c) => ({ key: "dinner_empty", mood: "thinking", text: "Fehlt noch das Abendessen? Dann ist dein Tag komplett.", action: { label: "Abendessen loggen", href: logHref(mealNamed(c, /abend/i)?.id) } }),
  },
  {
    key: "streak_at_risk",
    applies: (c) => c.hour >= 18 && !c.streak.todayLogged && c.streak.current >= 2,
    build: (c) => ({ key: "streak_at_risk", mood: "encouraging", text: `Deine Serie steht bei ${c.streak.current} Tagen. Ein Eintrag heute hält sie am Laufen.`, action: { label: "Jetzt loggen", href: "/log" } }),
  },
  {
    key: "over_target",
    applies: (c) => !!c.targetKcal && c.consumedKcal > c.targetKcal * 1.05,
    build: () => ({ key: "over_target", mood: "neutral", text: "Heute etwas über dem Ziel. Das gleicht sich über die Woche aus. Morgen geht es entspannt weiter." }),
  },
  {
    key: "close_to_target",
    applies: (c) => !!c.targetKcal && c.consumedKcal >= c.targetKcal * 0.9 && c.consumedKcal <= c.targetKcal * 1.05,
    build: () => ({ key: "close_to_target", mood: "happy", text: "Du bist genau im Zielbereich für heute." }),
  },
  {
    key: "water",
    applies: (c) => c.hour >= 14 && c.waterGoalMl > 0 && c.waterMl < c.waterGoalMl * 0.4,
    build: () => ({ key: "water", mood: "thinking", text: "Kleine Erinnerung: ein Glas Wasser zwischendurch?", action: { label: "Wasser eintragen", href: "/activity" } }),
  },
  {
    key: "weight_trend",
    applies: (c) => c.weightDirection === "towards",
    build: () => ({ key: "weight_trend", mood: "happy", text: "Dein 7-Tage-Durchschnitt bewegt sich in Richtung deines Ziels.", action: { label: "Trend ansehen", href: "/progress/weight" } }),
  },
  {
    key: "weight_reminder",
    applies: (c) => c.daysSinceWeight != null && c.daysSinceWeight >= 7,
    build: () => ({ key: "weight_reminder", mood: "neutral", text: "Magst du mal wieder dein Gewicht eintragen? Der Trend wird dadurch genauer.", action: { label: "Eintragen", href: "/progress/weight" } }),
  },
  {
    key: "late_evening",
    applies: (c) => c.hour >= 22 || c.hour < 5,
    build: (c) => ({ key: "late_evening", mood: "sleepy", text: c.entryCount > 0 ? `Heute ${c.entryCount} Einträge. Gute Nacht!` : "Gute Nacht! Morgen ist ein neuer Tag." }),
  },
  {
    key: "default",
    applies: () => true,
    build: (c) => ({ key: "default", mood: "neutral", text: c.entryCount > 0 ? "Läuft. Ich behalte deine Zahlen im Blick." : "Bereit, wenn du es bist." }),
  },
];

export function selectMascotMessage(c: MascotContext, rules: readonly Rule[] = MASCOT_RULES): MascotMessage {
  for (const r of rules) if (!c.dismissedKeys.includes(r.key) && r.applies(c)) return r.build(c);
  return MASCOT_RULES.at(-1)!.build(c);
}
