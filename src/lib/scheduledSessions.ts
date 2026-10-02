import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for class sessions. Every screen that needs to know
 * whether a class met on a date must go through `get_scheduled_sessions`, which
 * expands effective-dated schedules, holidays, cancellations and reschedules.
 */
export interface ScheduledSession {
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  kind: "regular" | "rescheduled" | "extra";
  is_frozen: boolean;
}

export const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");

export async function fetchScheduledSessions(from: Date | string, to: Date | string, classId?: string | null): Promise<ScheduledSession[]> {
  const f = typeof from === "string" ? from : toDateStr(from);
  const t = typeof to === "string" ? to : toDateStr(to);
  const { data, error } = await (supabase.rpc as any)("get_scheduled_sessions", {
    _from: f, _to: t, _class_id: classId ?? null,
  });
  if (error) throw error;
  return (data || []) as ScheduledSession[];
}

/** Session dates for one class over the past ~13 months (for marking calendars). */
export function useClassSessionDates(classId?: string | null) {
  const [dates, setDates] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!classId) { setDates(null); return; }
    let cancelled = false;
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - 400);
    fetchScheduledSessions(from, to, classId)
      .then((rows) => { if (!cancelled) setDates(new Set(rows.map((r) => r.session_date))); })
      .catch(() => { if (!cancelled) setDates(new Set()); });
    return () => { cancelled = true; };
  }, [classId]);
  return dates;
}

/** Sessions happening on a single date (used by schedules / dashboards). */
export async function fetchSessionsOn(date: Date, classIds?: string[]): Promise<ScheduledSession[]> {
  const rows = await fetchScheduledSessions(date, date);
  return classIds ? rows.filter((r) => classIds.includes(r.class_id)) : rows;
}

/** Current weekly slots per class (today's effective schedule). */
export interface WeeklySlot { class_id: string; day_of_week: number; start_time: string; end_time: string }
export async function fetchCurrentWeeklySlots(classIds?: string[]): Promise<WeeklySlot[]> {
  const today = toDateStr(new Date());
  let q = supabase.from("class_schedules" as any)
    .select("class_id, day_of_week, start_time, end_time, effective_from, effective_to")
    .lte("effective_from", today);
  if (classIds) q = q.in("class_id", classIds);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as any[]).filter((s) => !s.effective_to || s.effective_to >= today);
}
