import { format } from "date-fns";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface SessionDateOptions {
  /** Weekday the class meets on (0 = Sunday). Undefined = no class selected yet. */
  dayOfWeek?: number | null;
  /** Returns true when the date belongs to a frozen financial year. */
  isFrozen?: (dateStr: string) => boolean;
  /** Earliest allowed date (yyyy-MM-dd), e.g. a teacher's joining date. */
  minDate?: string | null;
}

/** True when attendance may be marked for this date. */
export function isMarkableSessionDate(d: Date, opts: SessionDateOptions): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return false;
  const dateStr = format(d, "yyyy-MM-dd");
  if (opts.dayOfWeek != null && d.getDay() !== opts.dayOfWeek) return false;
  if (opts.minDate && dateStr < opts.minDate) return false;
  if (opts.isFrozen?.(dateStr)) return false;
  return true;
}

/** Most recent markable date on or before `from` (searches back up to a year). */
export function latestSessionOnOrBefore(from: Date, opts: SessionDateOptions): Date | null {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d > today) d.setTime(today.getTime());
  for (let i = 0; i < 400; i++) {
    if (isMarkableSessionDate(d, opts)) return new Date(d);
    d.setDate(d.getDate() - 1);
  }
  return null;
}
