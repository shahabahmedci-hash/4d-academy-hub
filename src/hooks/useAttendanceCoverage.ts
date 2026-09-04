import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Attendance coverage: which scheduled class sessions have been marked and
 * which are still missing. A "session" is a class occurring on a date whose
 * weekday matches the class `day_of_week`.
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
  day_of_week: number;
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

function eachDate(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (d <= end) {
    out.push(format(d, "yyyy-MM-dd"));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

async function loadClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, subject, class, section, day_of_week")
    .order("subject");
  if (error) throw error;
  return data || [];
}

async function archivedProfileIds(userIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const { data } = await supabase.from("profiles").select("id, archived").in("id", ids);
  return new Set((data || []).filter((p) => p.archived).map((p) => p.id));
}

/** Student-side coverage over a date range. */
export async function fetchStudentCoverage(from: Date, to: Date): Promise<CoverageSession[]> {
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");

  const [classes, enrollRes, studentRes, attRes] = await Promise.all([
    loadClasses(),
    supabase.from("class_enrollments").select("class_id, student_id"),
    supabase.from("students").select("id, user_id, enrollment_date, exit_date"),
    supabase.from("attendance").select("class_id, date, student_id").gte("date", fromStr).lte("date", toStr),
  ]);
  if (enrollRes.error) throw enrollRes.error;
  if (studentRes.error) throw studentRes.error;
  if (attRes.error) throw attRes.error;

  const archived = await archivedProfileIds((studentRes.data || []).map((s) => s.user_id).filter(Boolean) as string[]);
  const studentMap = new Map(
    (studentRes.data || [])
      .filter((s) => !(s.user_id && archived.has(s.user_id)))
      .map((s) => [s.id, s]),
  );

  const byClass = new Map<string, { enrollment_date: string; exit_date: string | null }[]>();
  (enrollRes.data || []).forEach((e) => {
    const s = studentMap.get(e.student_id);
    if (!s) return;
    const list = byClass.get(e.class_id) || [];
    list.push({ enrollment_date: s.enrollment_date, exit_date: s.exit_date });
    byClass.set(e.class_id, list);
  });

  const markedCount = new Map<string, number>();
  (attRes.data || []).forEach((r) => {
    const k = `${r.class_id}|${r.date}`;
    markedCount.set(k, (markedCount.get(k) || 0) + 1);
  });

  return buildSessions(classes, from, to, (classId, dateStr) => {
    const members = byClass.get(classId) || [];
    return members.filter((m) => m.enrollment_date <= dateStr && (!m.exit_date || m.exit_date >= dateStr)).length;
  }, markedCount);
}

/** Teacher-side coverage over a date range. */
export async function fetchTeacherCoverage(from: Date, to: Date): Promise<CoverageSession[]> {
  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");

  const [classes, assignRes, teacherRes, attRes] = await Promise.all([
    loadClasses(),
    supabase.from("teacher_classes").select("class_id, teacher_id"),
    supabase.from("teachers").select("id, user_id, joining_date"),
    supabase.from("teacher_attendance").select("class_id, date, teacher_id").gte("date", fromStr).lte("date", toStr),
  ]);
  if (assignRes.error) throw assignRes.error;
  if (teacherRes.error) throw teacherRes.error;
  if (attRes.error) throw attRes.error;

  const archived = await archivedProfileIds((teacherRes.data || []).map((t) => t.user_id).filter(Boolean) as string[]);
  const teacherMap = new Map(
    (teacherRes.data || [])
      .filter((t) => !(t.user_id && archived.has(t.user_id)))
      .map((t) => [t.id, t]),
  );

  const byClass = new Map<string, { joining_date: string }[]>();
  (assignRes.data || []).forEach((a) => {
    const t = teacherMap.get(a.teacher_id);
    if (!t) return;
    const list = byClass.get(a.class_id) || [];
    list.push({ joining_date: t.joining_date });
    byClass.set(a.class_id, list);
  });

  const markedCount = new Map<string, number>();
  (attRes.data || []).forEach((r) => {
    const k = `${r.class_id}|${r.date}`;
    markedCount.set(k, (markedCount.get(k) || 0) + 1);
  });

  return buildSessions(classes, from, to, (classId, dateStr) => {
    const members = byClass.get(classId) || [];
    return members.filter((m) => m.joining_date <= dateStr).length;
  }, markedCount);
}

function buildSessions(
  classes: ClassRow[],
  from: Date,
  to: Date,
  expectedFor: (classId: string, dateStr: string) => number,
  markedCount: Map<string, number>,
): CoverageSession[] {
  const dates = eachDate(from, to);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessions: CoverageSession[] = [];

  classes.forEach((c) => {
    dates.forEach((dateStr) => {
      if (dateStr > todayStr) return;
      const weekday = new Date(`${dateStr}T00:00:00`).getDay();
      if (weekday !== c.day_of_week) return;
      const expected = expectedFor(c.id, dateStr);
      if (expected === 0) return;
      const marked = Math.min(markedCount.get(`${c.id}|${dateStr}`) || 0, expected);
      const state: CoverageState = marked === 0 ? "missing" : marked >= expected ? "complete" : "partial";
      sessions.push({
        key: `${c.id}|${dateStr}`,
        classId: c.id,
        subject: c.subject,
        class: c.class,
        section: c.section,
        date: dateStr,
        expected,
        marked,
        state,
      });
    });
  });

  // Oldest gaps first, complete sessions last.
  const order: Record<CoverageState, number> = { missing: 0, partial: 1, complete: 2 };
  return sessions.sort((a, b) => order[a.state] - order[b.state] || a.date.localeCompare(b.date));
}

/** Count of sessions with no attendance at all in the last N days (both domains). */
export async function fetchUnmarkedCount(days = 30): Promise<number> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const [students, teachers] = await Promise.all([fetchStudentCoverage(from, to), fetchTeacherCoverage(from, to)]);
  return [...students, ...teachers].filter((s) => s.state !== "complete").length;
}
