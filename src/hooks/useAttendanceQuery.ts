import { supabase } from "@/integrations/supabase/client";

/**
 * Single authoritative attendance access layer.
 * Every attendance screen (admin, co-admin, teacher, student) reads and writes
 * through these helpers so filtering, statistics and charts stay consistent.
 *
 * Storable statuses are limited to what the database accepts:
 *   - public.attendance.status         -> enum attendance_status (present | absent)
 *   - public.teacher_attendance.status -> check constraint (present | absent)
 */
export const ATTENDANCE_STATUSES = ["present", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface ClassRef {
  id?: string;
  subject: string;
  class: string | null;
  section: string | null;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  class_id: string | null;
  classes: ClassRef;
}

export interface EligibleStudent {
  id: string;
  student_id: string | null;
  user_id: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  class: string | null;
  section: string | null;
}

export interface EligibleTeacher {
  id: string;
  employee_id: string | null;
  user_id: string | null;
  full_name: string;
  email: string;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export function computeAttendanceStats(records: { status: string }[]): AttendanceStats {
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const total = present + absent;
  return { present, absent, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
}

export function classLabel(c?: ClassRef | null): string {
  if (!c) return "—";
  const parts = [c.subject];
  if (c.class) parts.push(`Class ${c.class}`);
  if (c.section) parts.push(`Batch ${c.section}`);
  return parts.join(" · ");
}

async function loadClassMap(classIds: string[]): Promise<Record<string, ClassRef>> {
  const map: Record<string, ClassRef> = {};
  const ids = [...new Set(classIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await supabase.from("classes").select("id, subject, class, section").in("id", ids);
  (data || []).forEach((c) => {
    map[c.id] = { id: c.id, subject: c.subject, class: c.class, section: c.section };
  });
  return map;
}

/** Student attendance records with their class context. */
export async function fetchStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, date, status, notes, class_id")
    .eq("student_id", studentId)
    .order("date", { ascending: false });
  if (error) throw error;

  const rows = data || [];
  const map = await loadClassMap(rows.map((r) => r.class_id).filter(Boolean) as string[]);
  return rows.map((r) => ({
    ...r,
    classes: (r.class_id && map[r.class_id]) || { subject: "—", class: null, section: null },
  }));
}

/** Teacher attendance records with their class context. */
export async function fetchTeacherAttendance(teacherId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("teacher_attendance")
    .select("id, date, status, notes, class_id")
    .eq("teacher_id", teacherId)
    .order("date", { ascending: false });
  if (error) throw error;

  const rows = data || [];
  const map = await loadClassMap(rows.map((r) => r.class_id).filter(Boolean) as string[]);
  return rows.map((r) => ({
    ...r,
    classes: (r.class_id && map[r.class_id]) || { subject: "—", class: null, section: null },
  }));
}

/**
 * Students who legitimately belonged to a class on a given date.
 * Excludes students enrolled after the date, students who exited before it,
 * and archived profiles.
 */
export async function fetchEligibleStudents(classId: string, dateStr: string): Promise<EligibleStudent[]> {
  const { data: enrollments, error: enrollError } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .eq("class_id", classId);
  if (enrollError) throw enrollError;

  const ids = (enrollments || []).map((e) => e.student_id);
  if (ids.length === 0) return [];

  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, student_id, user_id, class, section, enrollment_date, exit_date")
    .in("id", ids)
    .lte("enrollment_date", dateStr)
    .or(`exit_date.is.null,exit_date.gte.${dateStr}`);
  if (studentError) throw studentError;

  const rows = students || [];
  if (rows.length === 0) return [];

  const userIds = rows.map((s) => s.user_id).filter(Boolean) as string[];
  const profileMap: Record<string, { full_name: string; email: string; avatar_url: string | null; archived: boolean | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, archived")
      .in("id", userIds);
    (profiles || []).forEach((p) => {
      profileMap[p.id] = { full_name: p.full_name, email: p.email, avatar_url: p.avatar_url, archived: p.archived };
    });
  }

  return rows
    .filter((s) => !(s.user_id && profileMap[s.user_id]?.archived))
    .map((s) => ({
      id: s.id,
      student_id: s.student_id,
      user_id: s.user_id,
      full_name: (s.user_id && profileMap[s.user_id]?.full_name) || "Unknown Student",
      email: (s.user_id && profileMap[s.user_id]?.email) || "",
      avatar_url: (s.user_id && profileMap[s.user_id]?.avatar_url) || null,
      class: s.class,
      section: s.section,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Teachers assigned to a class who had already joined by the given date. */
export async function fetchEligibleTeachers(classId: string, dateStr: string): Promise<EligibleTeacher[]> {
  const { data: assignments, error } = await supabase
    .from("teacher_classes")
    .select("teacher_id")
    .eq("class_id", classId);
  if (error) throw error;

  const ids = (assignments || []).map((a) => a.teacher_id);
  if (ids.length === 0) return [];

  const { data: teachers, error: teacherError } = await supabase
    .from("teachers")
    .select("id, employee_id, user_id, joining_date")
    .in("id", ids)
    .lte("joining_date", dateStr);
  if (teacherError) throw teacherError;

  const rows = teachers || [];
  if (rows.length === 0) return [];

  const userIds = rows.map((t) => t.user_id).filter(Boolean) as string[];
  const profileMap: Record<string, { full_name: string; email: string; archived: boolean | null }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, archived").in("id", userIds);
    (profiles || []).forEach((p) => {
      profileMap[p.id] = { full_name: p.full_name, email: p.email, archived: p.archived };
    });
  }

  return rows
    .filter((t) => !(t.user_id && profileMap[t.user_id]?.archived))
    .map((t) => ({
      id: t.id,
      employee_id: t.employee_id,
      user_id: t.user_id,
      full_name: (t.user_id && profileMap[t.user_id]?.full_name) || "Unknown Teacher",
      email: (t.user_id && profileMap[t.user_id]?.email) || "",
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Existing student attendance for one class/date, as studentId -> status. */
export async function fetchClassAttendanceMap(classId: string, dateStr: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("attendance")
    .select("student_id, status")
    .eq("class_id", classId)
    .eq("date", dateStr);
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.student_id, r.status]));
}

/** Existing teacher attendance for one class/date, as teacherId -> status. */
export async function fetchClassTeacherAttendanceMap(classId: string, dateStr: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("teacher_attendance")
    .select("teacher_id, status")
    .eq("class_id", classId)
    .eq("date", dateStr);
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.teacher_id, r.status]));
}

export async function saveStudentAttendance(
  rows: { student_id: string; class_id: string; date: string; status: AttendanceStatus }[],
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("attendance")
    .upsert(rows.map((r) => ({ ...r, marked_by: user?.id })), { onConflict: "student_id,class_id,date" });
  if (error) throw error;
}

export async function saveTeacherAttendance(
  rows: { teacher_id: string; class_id: string; date: string; status: AttendanceStatus }[],
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("teacher_attendance")
    .upsert(rows.map((r) => ({ ...r, marked_by: user?.id })), { onConflict: "teacher_id,class_id,date" });
  if (error) throw error;
}
