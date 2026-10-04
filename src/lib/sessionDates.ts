import { format } from "date-fns";
import type { DateRange } from "@/lib/dateRange";
import type { SessionAttendanceStatus } from "@/lib/scheduledSessions";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface SessionDateOptions {
  /** Real session dates (yyyy-MM-dd) for the selected class, from the schedule source of truth. */
  sessionDates?: Set<string> | null;
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
  if (opts.sessionDates && !opts.sessionDates.has(dateStr)) return false;
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
 * Totals for the history strip. Rows come from `get_session_attendance_status`
 * (session exists + person eligible), so eligibility and session existence are
 * decided once in the database. This only applies the on-screen date range and
 * skips frozen financial-year dates.
 */
export function countPersonSessions(rows: SessionAttendanceStatus[], range?: DateRange): SessionCount {
  const fromStr = range?.from ? format(range.from, "yyyy-MM-dd") : null;
  const toRaw = range?.to ?? range?.from;
  const toStr = toRaw ? format(toRaw, "yyyy-MM-dd") : null;
  let scheduled = 0;
  let marked = 0;
  rows.forEach((r) => {
    if (r.is_frozen) return;
    if (fromStr && r.session_date < fromStr) return;
    if (toStr && r.session_date > toStr) return;
    scheduled++;
    if (r.marked) marked++;
  });
  return { scheduled, marked, unmarked: scheduled - marked };
}
