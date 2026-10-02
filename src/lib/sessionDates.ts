import { format } from "date-fns";
import type { DateRange } from "@/lib/dateRange";
import type { ScheduledSession } from "@/lib/scheduledSessions";

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
 * Counts real scheduled sessions the person was eligible for against their saved
 * attendance. Sessions come from the schedule source of truth — attendance is
 * never used to infer that a session existed.
 */
export function countPersonSessions(
  records: { date: string; class_id: string | null }[],
  sessions: ScheduledSession[],
  eligibleFrom: string | null,
  eligibleTo: string | null,
  range?: DateRange,
  isFrozen?: (dateStr: string) => boolean,
): SessionCount {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const fromStr = range?.from ? format(range.from, "yyyy-MM-dd") : null;
  const toRaw = range?.to ?? range?.from;
  const toStr = toRaw ? format(toRaw, "yyyy-MM-dd") : null;
  const markedPairs = new Set(records.filter((r) => r.class_id).map((r) => `${r.class_id}|${r.date}`));

  let scheduled = 0;
  let marked = 0;
  sessions.forEach((s) => {
    const ds = s.session_date;
    if (ds > todayStr) return;
    if (eligibleFrom && ds < eligibleFrom) return;
    if (eligibleTo && ds > eligibleTo) return;
    if (fromStr && ds < fromStr) return;
    if (toStr && ds > toStr) return;
    if (isFrozen?.(ds)) return;
    scheduled++;
    if (markedPairs.has(`${s.class_id}|${ds}`)) marked++;
  });
  return { scheduled, marked, unmarked: Math.max(scheduled - marked, 0) };
}
