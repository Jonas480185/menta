import { ISO_DATE_RE, todayInTimezone, type IsoDate } from "@/lib/dates";
import { validationError } from "@/lib/errors";
import type { ServiceContext } from "@/server/context";

/** "Today" in the user's timezone – the boundary between frozen (past) and live days. */
export function todayFor(ctx: ServiceContext): IsoDate {
  return todayInTimezone(ctx.timezone);
}

/** Guards against malformed dates reaching SQL (callers validate with Zod; this is the backstop). */
export function assertIsoDate(date: string, field = "date"): asserts date is IsoDate {
  const parsed = ISO_DATE_RE.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  // Round-trip rejects impossible calendar dates like 2026-02-31.
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw validationError({ [field]: ["Ungültiges Datum."] });
  }
}
