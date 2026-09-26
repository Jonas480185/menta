import { ISO_DATE_RE, type IsoDate } from "@/lib/dates";

function parseIsoDate(value: IsoDate, name: string): { y: number; m: number; d: number } {
  if (!ISO_DATE_RE.test(value)) throw new RangeError(`${name} must be an ISO date (YYYY-MM-DD), got "${value}"`);
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new RangeError(`${name} is not a valid calendar date: "${value}"`);
  }
  return { y, m, d };
}

/**
 * Age in completed years on `onDate` (both ISO calendar dates in the user's timezone).
 * The birthday counts from its calendar day on; people born on 29 Feb turn a year older
 * on 1 Mar in non-leap years.
 *
 *   calculateAge("1993-05-10", "2026-05-09") // 32
 *   calculateAge("1993-05-10", "2026-05-10") // 33
 *
 * Throws RangeError for malformed dates or when onDate is before birthDate.
 */
export function calculateAge(birthDate: IsoDate, onDate: IsoDate): number {
  const b = parseIsoDate(birthDate, "birthDate");
  const o = parseIsoDate(onDate, "onDate");
  if (onDate < birthDate) throw new RangeError(`onDate (${onDate}) is before birthDate (${birthDate})`);
  const hadBirthday = o.m > b.m || (o.m === b.m && o.d >= b.d);
  return o.y - b.y - (hadBirthday ? 0 : 1);
}
