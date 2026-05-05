import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

/** Get current date/time in IST (UTC+5:30) */
const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
};

/** Format IST date as YYYY-MM-DD */
const getISTDateString = () => getISTDate().toISOString().split("T")[0];

/** Format IST date as YYYY-MM */
const getISTMonth = () => getISTDate().toISOString().slice(0, 7);

type AutomationResult = {
  message: string;
  count?: number;
  sent?: number;
};

type RecurringTemplate = {
  id: string;
  type: string;
  student_id: string | null;
  teacher_id: string | null;
  amount: number;
  interval: string;
  day_of_month: number;
  notes: string | null;
  category: string | null;
  admin_id: string | null;
  is_active: boolean;
  last_generated: string | null;
  created_by: string;
};

const MANUAL_TASKS = new Set([
  "process-recurring-templates",
  "auto-mark-overdue",
  "send-fee-reminders",
  "auto-attendance-summary",
]);

const isPreviewFetchError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|failed to send a request to the edge function/i.test(message);
};

const ensureAdminAccess = async () => {
  const [adminResult, coAdminResult, userResult] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("is_co_admin"),
    supabase.auth.getUser(),
  ]);

  if (adminResult.error) throw adminResult.error;
  if (coAdminResult.error) throw coAdminResult.error;
  if (userResult.error) throw userResult.error;

  const userId = userResult.data.user?.id;

  if (!userId) {
    throw new Error("Your session expired. Please sign in again.");
  }

  if (!adminResult.data && !coAdminResult.data) {
    throw new Error("Only admins can run automation tasks.");
  }

  return userId;
};

const processRecurringTemplatesFallback = async (): Promise<AutomationResult> => {
  const currentUserId = await ensureAdminAccess();
  const today = getISTDate();
  const dueDate = getISTDateString();
  const currentMonth = getISTMonth();

  const { data: templates, error: fetchError } = await supabase
    .from("recurring_templates")
    .select("*")
    .eq("is_active", true);

  if (fetchError) throw fetchError;
  if (!templates?.length) {
    return { message: "No active templates found." };
  }

  const candidateProfileIds = Array.from(
    new Set(
      [
        currentUserId,
        ...templates.flatMap((template) =>
          [template.created_by, template.admin_id].filter(Boolean)
        ),
      ]
    )
  );

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .in("id", candidateProfileIds);

  if (profileError) throw profileError;

  const validProfileIds = new Set((profiles || []).map((profile) => profile.id));
  let processed = 0;

  for (const template of templates as RecurringTemplate[]) {
    if (template.last_generated) {
      const lastGenerated = new Date(template.last_generated);
      const lastGeneratedMonth = lastGenerated.toISOString().slice(0, 7);

      if (template.interval === "monthly" && lastGeneratedMonth === currentMonth) continue;
      if (template.interval === "fortnightly") {
        const daysSince = (today.getTime() - lastGenerated.getTime()) / (1000 * 3600 * 24);
        if (daysSince < 13) continue;
      }
      if (template.interval === "quarterly") {
        const monthsDiff =
          (today.getFullYear() - lastGenerated.getFullYear()) * 12 +
          (today.getMonth() - lastGenerated.getMonth());
        if (monthsDiff < 3) continue;
      }
      if (template.interval === "yearly") {
        const monthsDiff =
          (today.getFullYear() - lastGenerated.getFullYear()) * 12 +
          (today.getMonth() - lastGenerated.getMonth());
        if (monthsDiff < 12) continue;
      }
    }

    const validCreatedBy = [template.created_by, template.admin_id, currentUserId].find(
      (profileId) => !!profileId && validProfileIds.has(profileId)
    );

    if (template.type === "fee" && template.student_id) {
      const { error } = await supabase.from("fees").insert({
        student_id: template.student_id,
        amount: template.amount,
        due_date: dueDate,
        status: "pending",
        notes: template.notes || "Auto-generated from recurring template",
      });

      if (error) continue;
    } else if (template.type === "salary" && template.teacher_id && validCreatedBy) {
      const { error } = await supabase.from("teacher_salaries").insert({
        teacher_id: template.teacher_id,
        amount: template.amount,
        month: `${currentMonth}-01`,
        status: "pending",
        created_by: validCreatedBy,
        notes: template.notes || "Auto-generated from recurring template",
      });

      if (error) continue;
    } else if (template.type === "expense" && validCreatedBy) {
      const { error } = await supabase.from("expenses").insert({
        amount: template.amount,
        category: template.category === "admin_personal" ? "admin_personal" : (template.category as "rent" | "utilities" | "supplies" | "marketing" | "other" | null) || "other",
        description: template.notes || "Auto-generated recurring expense",
        date: dueDate,
        created_by: validCreatedBy,
        admin_id: template.admin_id && validProfileIds.has(template.admin_id) ? template.admin_id : null,
      });

      if (error) continue;
    } else {
      continue;
    }

    await supabase
      .from("recurring_templates")
      .update({ last_generated: dueDate })
      .eq("id", template.id);

    processed += 1;
  }

  return { message: `Processed ${processed} recurring template(s).` };
};

const autoMarkOverdueFallback = async (): Promise<AutomationResult> => {
  await ensureAdminAccess();
  const today = getISTDateString();

  const { data, error } = await supabase
    .from("fees")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", today)
    .select("id");

  if (error) throw error;

  const count = data?.length || 0;
  return { message: `Marked ${count} fee(s) as overdue`, count };
};

const sendFeeRemindersFallback = async (): Promise<AutomationResult> => {
  await ensureAdminAccess();

  const threeDaysFromNow = getISTDate();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const cutoffDate = threeDaysFromNow.toISOString().split("T")[0];

  const { data: fees, error: feesError } = await supabase
    .from("fees")
    .select("id, student_id, amount, due_date, status")
    .in("status", ["pending", "overdue"])
    .lte("due_date", cutoffDate);

  if (feesError) throw feesError;
  if (!fees?.length) {
    return { message: "No upcoming or overdue fees found", sent: 0 };
  }

  const studentIds = [...new Set(fees.map((fee) => fee.student_id))];
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, user_id")
    .in("id", studentIds);

  if (studentsError) throw studentsError;

  const studentUserMap = Object.fromEntries(
    (students || []).filter((student) => student.user_id).map((student) => [student.id, student.user_id])
  );

  const now = getISTDate();
  const notifications = fees
    .filter((fee) => studentUserMap[fee.student_id])
    .map((fee) => {
      const isOverdue = new Date(`${fee.due_date}T00:00:00`) < now;

      return {
        user_id: studentUserMap[fee.student_id],
        title: isOverdue ? "Fee Overdue" : "Fee Reminder",
        message: isOverdue
          ? `Your fee of ₹${fee.amount} was due on ${fee.due_date}. Please pay immediately.`
          : `Your fee of ₹${fee.amount} is due on ${fee.due_date}. Please pay on time.`,
        type: "fee_reminder",
      };
    });

  if (notifications.length > 0) {
    const { error: insertError } = await supabase.from("notifications").insert(notifications);
    if (insertError) throw insertError;
  }

  return { message: "Fee reminders sent", sent: notifications.length };
};

const autoAttendanceSummaryFallback = async (): Promise<AutomationResult> => {
  await ensureAdminAccess();

  const now = getISTDate();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const startDate = weekAgo.toISOString().split("T")[0];
  const endDate = getISTDateString();

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, user_id")
    .not("user_id", "is", null);

  if (studentsError) throw studentsError;
  if (!students?.length) {
    return { message: "No students found", sent: 0 };
  }

  const userIds = students.map((student) => student.user_id!).filter(Boolean);
  const { data: nonStudentRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("user_id", userIds)
    .in("role", ["admin", "co_admin", "teacher"]);

  if (rolesError) throw rolesError;

  const excludedUserIds = new Set((nonStudentRoles || []).map((row) => row.user_id));
  const actualStudents = students.filter((student) => !excludedUserIds.has(student.user_id!));

  if (!actualStudents.length) {
    return { message: "No student-only users found", sent: 0 };
  }

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("student_id, status")
    .gte("date", startDate)
    .lte("date", endDate);

  if (attendanceError) throw attendanceError;

  const notifications = actualStudents
    .map((student) => {
      const records = (attendance || []).filter((entry) => entry.student_id === student.id);
      if (!records.length) return null;

      const presentCount = records.filter((entry) => entry.status === "present").length;
      const totalCount = records.length;
      const percentage = Math.round((presentCount / totalCount) * 100);

      return {
        user_id: student.user_id!,
        title: "Weekly Attendance Summary",
        message: `You attended ${presentCount}/${totalCount} classes this week (${percentage}%).`,
        type: "attendance_summary",
      };
    })
    .filter(Boolean);

  if (notifications.length > 0) {
    const { error: insertError } = await supabase.from("notifications").insert(notifications);
    if (insertError) throw insertError;
  }

  return { message: "Attendance summaries sent", sent: notifications.length };
};

const runManualFallback = async (taskKey: string): Promise<AutomationResult> => {
  switch (taskKey) {
    case "process-recurring-templates":
      return processRecurringTemplatesFallback();
    case "auto-mark-overdue":
      return autoMarkOverdueFallback();
    case "send-fee-reminders":
      return sendFeeRemindersFallback();
    case "auto-attendance-summary":
      return autoAttendanceSummaryFallback();
    default:
      throw new Error("No manual fallback available for this task.");
  }
};

export const runAutomationTask = async (taskKey: string): Promise<AutomationResult> => {
  if (!MANUAL_TASKS.has(taskKey)) {
    // For unknown tasks, try edge function only
    return invokeEdgeFunction(taskKey, {
      body: {},
      headers: { "x-manual-trigger": "true" },
    });
  }

  // For known tasks, always prefer the client-side fallback for reliability
  // Edge functions are used by the automated scheduler; manual runs use direct DB access
  return runManualFallback(taskKey);
};