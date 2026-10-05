/**
 * Weekday schedules of day profiles and the resolution precedence ("which profile applies on day X").
 *
 * Rules:
 * - Weekdays are ISO 1 (Mon) … 7 (Sun), unique, sorted.
 * - A weekday may be assigned to at most one active (non-archived) profile.
 * - The default profile carries no weekdays: it is the fallback for every unassigned day.
 *
 * Precedence (pickDayProfile):
 *   1. explicit per-date override (daily_nutrition.profile_overridden) to an active profile
 *   2. an active profile scheduled on the date's weekday
 *   3. the active default profile
 *   4. none (onboarding not finished)
 */
import { MacroInputError } from "./types";

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_NAMES: Readonly<Record<IsoWeekday, string>> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
  7: "Sonntag",
};

export const WEEKDAY_SHORT: Readonly<Record<IsoWeekday, string>> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

export function isIsoWeekday(n: unknown): n is IsoWeekday {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7;
}

/** Validates, dedupes and sorts weekdays. Throws MacroInputError for anything outside 1-7. */
export function normalizeWeekdays(weekdays: readonly number[]): IsoWeekday[] {
  for (const d of weekdays) {
    if (!isIsoWeekday(d)) {
      throw new MacroInputError("invalid_weekday", "Ungültiger Wochentag.", "weekdays");
    }
  }
  return [...new Set(weekdays as IsoWeekday[])].sort((a, b) => a - b);
}

export interface ScheduledProfile {
  id: string;
  name: string;
  weekdays: readonly number[];
  archived?: boolean;
}

export interface WeekdayConflict {
  weekday: IsoWeekday;
  profileId: string;
  profileName: string;
}

/**
 * Weekdays of `weekdays` already taken by another active profile in `profiles`
 * (the candidate itself, identified by `candidateId`, is ignored).
 */
export function findWeekdayConflicts(
  profiles: readonly ScheduledProfile[],
  candidateId: string | null,
  weekdays: readonly number[],
): WeekdayConflict[] {
  const wanted = new Set(weekdays);
  const conflicts: WeekdayConflict[] = [];
  for (const p of profiles) {
    if (p.archived || p.id === candidateId) continue;
    for (const d of p.weekdays) {
      if (wanted.has(d) && isIsoWeekday(d)) {
        conflicts.push({ weekday: d, profileId: p.id, profileName: p.name });
      }
    }
  }
  return conflicts.sort((a, b) => a.weekday - b.weekday);
}

/** Checks a whole schedule: every weekday used by more than one active profile. */
export function validateWeekdaySchedule(profiles: readonly ScheduledProfile[]): {
  ok: boolean;
  conflicts: { weekday: IsoWeekday; profileIds: string[] }[];
} {
  const byDay = new Map<IsoWeekday, string[]>();
  for (const p of profiles) {
    if (p.archived) continue;
    for (const d of new Set(p.weekdays)) {
      if (!isIsoWeekday(d)) continue;
      byDay.set(d, [...(byDay.get(d) ?? []), p.id]);
    }
  }
  const conflicts = [...byDay.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([weekday, profileIds]) => ({ weekday, profileIds }))
    .sort((a, b) => a.weekday - b.weekday);
  return { ok: conflicts.length === 0, conflicts };
}

/**
 * German, friendly conflict message:
 *   „Montag ist bereits dem Profil „Ruhetag“ zugeordnet.“
 *   „Montag und Mittwoch sind bereits dem Profil „Ruhetag“ zugeordnet.“
 */
export function describeWeekdayConflicts(conflicts: readonly WeekdayConflict[]): string {
  if (conflicts.length === 0) return "";
  const byProfile = new Map<string, WeekdayConflict[]>();
  for (const c of conflicts) byProfile.set(c.profileName, [...(byProfile.get(c.profileName) ?? []), c]);
  const parts = [...byProfile.entries()].map(([name, cs]) => {
    const days = joinGerman(cs.map((c) => WEEKDAY_NAMES[c.weekday]));
    const verb = cs.length === 1 ? "ist" : "sind";
    return `${days} ${verb} bereits dem Profil „${name}“ zugeordnet.`;
  });
  return `${parts.join(" ")} Entferne ${conflicts.length === 1 ? "den Tag" : "die Tage"} dort zuerst.`;
}

function joinGerman(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

export interface ResolvableProfile {
  id: string;
  isDefault: boolean;
  weekdays: readonly number[];
  archived: boolean;
  /** Tie-breaker if data ever contains overlapping weekdays: oldest profile wins. */
  createdAt?: Date | string | number;
}

/**
 * Picks the profile that applies to a day (precedence see module doc). Pure: the service loads
 * profiles and overrides and delegates the decision here.
 */
export function pickDayProfile<P extends ResolvableProfile>(
  profiles: readonly P[],
  day: { weekday: number; overrideProfileId?: string | null },
): P | null {
  const active = profiles.filter((p) => !p.archived);
  if (day.overrideProfileId) {
    const override = active.find((p) => p.id === day.overrideProfileId);
    if (override) return override;
  }
  const scheduled = active
    .filter((p) => !p.isDefault && p.weekdays.includes(day.weekday))
    .sort((a, b) => time(a.createdAt) - time(b.createdAt));
  if (scheduled.length > 0) return scheduled[0];
  return active.find((p) => p.isDefault) ?? null;
}

function time(v: Date | string | number | undefined): number {
  if (v === undefined) return 0;
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}
