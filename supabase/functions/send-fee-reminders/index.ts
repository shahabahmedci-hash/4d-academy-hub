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

    // Check if this task is enabled
    const { data: automationSetting } = await supabase
      .from("automation_settings")
      .select("enabled")
      .eq("task_key", "send-fee-reminders")
      .single();

    const isManual = req.headers.get("x-manual-trigger") === "true";
    if (!isManual && automationSetting && !automationSetting.enabled) {
      return new Response(
        JSON.stringify({ message: "Task is disabled.", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isScheduler = token === serviceRoleKey;

    if (!isScheduler) {
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: isAdmin } = await anonClient.rpc("is_admin");
      const { data: isCoAdmin } = await anonClient.rpc("is_co_admin");
      if (!isAdmin && !isCoAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get pending/overdue fees with due_date within 3 days or past
    const threeDaysFromNow = getISTDate();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const cutoffDate = threeDaysFromNow.toISOString().split("T")[0];

    const { data: fees, error: feesError } = await supabase
      .from("fees")
      .select("id, student_id, amount, due_date, status")
      .in("status", ["pending", "overdue"])
      .lte("due_date", cutoffDate);

    if (feesError) throw feesError;
    if (!fees || fees.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming or overdue fees found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get student user_ids
    const studentIds = [...new Set(fees.map((f) => f.student_id))];
    const { data: students } = await supabase
      .from("students")
      .select("id, user_id")
      .in("id", studentIds);

    if (!students) {
      return new Response(
        JSON.stringify({ message: "No students found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const studentUserMap = Object.fromEntries(
      students.filter((s) => s.user_id).map((s) => [s.id, s.user_id])
    );

    // Create notifications
    const now = getISTDate();
    const notifications = fees
      .filter((f) => studentUserMap[f.student_id])
      .map((f) => {
        const dueDate = new Date(f.due_date);
        const isOverdue = dueDate < now;
        return {
          user_id: studentUserMap[f.student_id],
          title: isOverdue ? "Fee Overdue" : "Fee Reminder",
          message: isOverdue
            ? `Your fee of ₹${f.amount} was due on ${f.due_date}. Please pay immediately.`
            : `Your fee of ₹${f.amount} is due on ${f.due_date}. Please pay on time.`,
          type: "fee_reminder",
        };
      });

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifications);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ message: "Fee reminders sent", sent: notifications.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
