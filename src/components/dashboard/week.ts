import { addDays, isoWeekday, type IsoDate } from "@/lib/dates";

export interface WeekDay {
  date: IsoDate;
  /** Consumed kcal (0 when nothing logged). */
  kcal: number;
  /** Target kcal snapshot for the day, null if unknown. */
  target: number | null;
  logged: boolean;
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: IsoDate): IsoDate {
  return addDays(date, -(isoWeekday(date) - 1));
}

/**
 * The seven days (Mon–Sun) around `date`, merged with logged-day rows. Days without a row are
 * "not logged"; their target falls back to `fallbackTarget` (e.g. today's live target).
 */
export function buildWeek(
  date: IsoDate,
  rows: readonly { date: IsoDate; kcal: number; target: number | null }[],
  fallbackTarget: number | null,
): WeekDay[] {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const row = byDate.get(d);
    return {
      date: d,
      kcal: row?.kcal ?? 0,
      target: row?.target ?? fallbackTarget,
      logged: !!row,
    };
  });
}

export type DayTone = "empty" | "under" | "good" | "over";

/** Traffic-light-free classification for the week ring: in range = good, clearly above = over. */
export function dayTone(day: Pick<WeekDay, "kcal" | "target" | "logged">): DayTone {
  if (!day.logged || !day.target) return day.logged ? "under" : "empty";
  const r = day.kcal / day.target;
  if (r > 1.05) return "over";
  if (r >= 0.9) return "good";
  return "under";
}
