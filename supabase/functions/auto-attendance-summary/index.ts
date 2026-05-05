import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Get current date/time in IST (UTC+5:30) */
const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
};

/** Format IST date as YYYY-MM-DD */
const getISTDateString = () => getISTDate().toISOString().split("T")[0];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin or co-admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isScheduler = token === serviceRoleKey;

    if (!isScheduler) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: isAdmin } = await anonClient.rpc("is_admin");
      const { data: isCoAdmin } = await anonClient.rpc("is_co_admin");
      if (!isAdmin && !isCoAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if this task is enabled
    const { data: automationSetting } = await supabase
      .from("automation_settings")
      .select("enabled, frequency")
      .eq("task_key", "auto-attendance-summary")
      .single();

    const isManual = req.headers.get("x-manual-trigger") === "true";
    if (!isManual && automationSetting && !automationSetting.enabled) {
      return new Response(
        JSON.stringify({ message: "Task is disabled.", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate past week date range
    const now = getISTDate();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().split("T")[0];
    const endDate = getISTDateString();

    // Get all students with user_id
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, user_id")
      .not("user_id", "is", null);

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ message: "No students found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out users who are admins, co-admins, or teachers
    const userIds = students.map((s) => s.user_id!);
    const { data: nonStudentRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("user_id", userIds)
      .in("role", ["admin", "co_admin", "teacher"]);

    const excludedUserIds = new Set((nonStudentRoles || []).map((r) => r.user_id));
    const actualStudents = students.filter((s) => !excludedUserIds.has(s.user_id!));

    if (actualStudents.length === 0) {
      return new Response(
        JSON.stringify({ message: "No student-only users found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get attendance records for the past week
    const { data: attendance, error: attError } = await supabase
      .from("attendance")
      .select("student_id, status")
      .gte("date", startDate)
      .lte("date", endDate);

    if (attError) throw attError;

    const notifications: { user_id: string; title: string; message: string; type: string }[] = [];

    for (const student of actualStudents) {
      const records = (attendance || []).filter((a) => a.student_id === student.id);
      if (records.length === 0) continue;

      const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
      const totalCount = records.length;
      const percentage = Math.round((presentCount / totalCount) * 100);

      notifications.push({
        user_id: student.user_id!,
        title: "Weekly Attendance Summary",
        message: `You attended ${presentCount}/${totalCount} classes this week (${percentage}%).`,
        type: "attendance_summary",
      });
    }

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ message: "Attendance summaries sent", sent: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
