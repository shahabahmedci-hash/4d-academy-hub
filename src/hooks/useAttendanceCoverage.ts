import { supabase } from "@/integrations/supabase/client";
import { fetchSessionAttendanceStatus } from "@/lib/scheduledSessions";

/**
 * Attendance coverage: which scheduled class sessions have been marked and
 * which are still missing. A "session" is a class occurring on a date whose
 * real scheduled session from the effective-dated schedule (get_scheduled_sessions).
 */

export type CoverageDomain = "students" | "teachers";
export type CoverageState = "complete" | "partial" | "missing";

export interface CoverageSession {
  key: string;
  classId: string;
  subject: string;
  class: string | null;
  section: string | null;
  date: string;
  expected: number;
  marked: number;
  state: CoverageState;
}

export interface CoverageSummary {
  expectedSessions: number;
  complete: number;
  partial: number;
  missing: number;
  unmarkedPeople: number;
}

interface ClassRow {
  id: string;
  subject: string;
  class: string | null;
  section: string | null;
}

export function summarizeCoverage(sessions: CoverageSession[]): CoverageSummary {
  return {
    expectedSessions: sessions.length,
    complete: sessions.filter((s) => s.state === "complete").length,
    partial: sessions.filter((s) => s.state === "partial").length,
    missing: sessions.filter((s) => s.state === "missing").length,
    unmarkedPeople: sessions.reduce((sum, s) => sum + (s.expected - s.marked), 0),
  };
}

async function loadClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, subject, class, section")
    .order("subject");
  if (error) throw error;
  return data || [];
}

async function coverageFor(domain: CoverageDomain, from: Date, to: Date): Promise<CoverageSession[]> {
  const [classes, rows] = await Promise.all([loadClasses(), fetchSessionAttendanceStatus(domain, from, to)]);
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const agg = new Map<string, { classId: string; date: string; expected: number; marked: number }>();
  rows.forEach((r) => {
    const key = `${r.class_id}|${r.session_date}`;
    const a = agg.get(key) || { classId: r.class_id, date: r.session_date, expected: 0, marked: 0 };
    a.expected++;
    if (r.marked) a.marked++;
    agg.set(key, a);
  });
  const sessions: CoverageSession[] = [];
  agg.forEach((a, key) => {
    const c = classMap.get(a.classId);
    if (!c) return;
    const state: CoverageState = a.marked === 0 ? "missing" : a.marked >= a.expected ? "complete" : "partial";
    sessions.push({ key, classId: c.id, subject: c.subject, class: c.class, section: c.section, date: a.date, expected: a.expected, marked: a.marked, state });
  });
  const order: Record<CoverageState, number> = { missing: 0, partial: 1, complete: 2 };
  return sessions.sort((x, y) => order[x.state] - order[y.state] || x.date.localeCompare(y.date));
}

/** Student-side coverage over a date range (rule evaluated in the database). */
export const fetchStudentCoverage = (from: Date, to: Date) => coverageFor("students", from, to);

/** Teacher-side coverage over a date range (rule evaluated in the database). */
export const fetchTeacherCoverage = (from: Date, to: Date) => coverageFor("teachers", from, to);

/** Count of sessions with no attendance at all in the last N days (both domains). */
export async function fetchUnmarkedCount(days = 30): Promise<number> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const [students, teachers] = await Promise.all([fetchStudentCoverage(from, to), fetchTeacherCoverage(from, to)]);
  return [...students, ...teachers].filter((s) => s.state !== "complete").length;
}
