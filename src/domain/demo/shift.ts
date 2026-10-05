/**
 * Public demo: the seeded diary is moved forward in time so the shared demo account never
 * looks abandoned. The anchor is the latest logged day up to today; when that day lies in
 * the past, the whole diary moves by the gap and the anchor day becomes today (entries kept).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days to move the demo diary forward (0 = already up to date or nothing logged). */
export function demoShiftDays(lastLoggedDate: string | null, today: string): number {
  if (!lastLoggedDate) return 0;
  const gap = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastLoggedDate}T00:00:00Z`)) / DAY_MS);
  return Number.isFinite(gap) && gap > 0 ? gap : 0;
}
