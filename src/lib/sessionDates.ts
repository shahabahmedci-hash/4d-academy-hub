import { format } from "date-fns";
import type { DateRange } from "@/lib/dateRange";

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

export interface SessionCount {
  scheduled: number;
  marked: number;
  unmarked: number;
}

/**
 * Counts scheduled class sessions for one person (student or teacher) against
 * the attendance rows actually saved, using each class's weekday.
 * Sessions before the person's first record for that class are ignored, since
 * the person was not attending it yet.
 */
export function countPersonSessions(
  records: { date: string; class_id: string | null }[],
  dayOfWeekByClass: Record<string, number>,
  range?: DateRange,
  isFrozen?: (dateStr: string) => boolean,
): SessionCount {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeTo = range?.to ?? range?.from;
  const to = rangeTo && rangeTo < today ? new Date(rangeTo) : today;
  to.setHours(0, 0, 0, 0);

  const firstByClass: Record<string, string> = {};
  const markedPairs = new Set<string>();
  records.forEach((r) => {
    if (!r.class_id) return;
    markedPairs.add(`${r.class_id}|${r.date}`);
    if (!firstByClass[r.class_id] || r.date < firstByClass[r.class_id]) firstByClass[r.class_id] = r.date;
  });

  let scheduled = 0;
  let marked = 0;
  Object.entries(firstByClass).forEach(([classId, firstDate]) => {
    const dow = dayOfWeekByClass[classId];
    if (dow == null) return;
    const rangeFrom = range?.from ? format(range.from, "yyyy-MM-dd") : firstDate;
    const startStr = rangeFrom > firstDate ? rangeFrom : firstDate;
    const d = new Date(`${startStr}T00:00:00`);
    while (d <= to) {
      if (d.getDay() === dow) {
        const ds = format(d, "yyyy-MM-dd");
        if (!isFrozen?.(ds)) {
          scheduled++;
          if (markedPairs.has(`${classId}|${ds}`)) marked++;
        }
      }
      d.setDate(d.getDate() + 1);
    }
  });

  return { scheduled, marked, unmarked: Math.max(scheduled - marked, 0) };
}
