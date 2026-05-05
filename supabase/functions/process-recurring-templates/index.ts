import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    let currentUserId: string | null = null;

    if (!isScheduler) {
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      currentUserId = claimsData.claims.sub;
      const { data: isAdmin } = await anonClient.rpc("is_admin");
      const { data: isCoAdmin } = await anonClient.rpc("is_co_admin");
      if (!isAdmin && !isCoAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const isManual = req.headers.get("x-manual-trigger") === "true";

    // Check if this task is enabled in automation_settings
    const { data: automationSetting } = await supabase
      .from("automation_settings")
      .select("enabled, frequency")
      .eq("task_key", "process-recurring-templates")
      .single();

    // If called by scheduler and disabled, skip
    if (!isManual && automationSetting && !automationSetting.enabled) {
      return new Response(
        JSON.stringify({ message: "Task is disabled." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = getISTDate();
    const dayOfMonth = today.getDate();
    const currentMonth = getISTMonth();

    // Manual runs should process all active templates so admins can test immediately.
    let templatesQuery = supabase
      .from("recurring_templates")
      .select("*")
      .eq("is_active", true);

    if (!isManual) {
      templatesQuery = templatesQuery.eq("day_of_month", dayOfMonth);
    }

    const { data: templates, error: fetchError } = await templatesQuery;

    if (fetchError) throw fetchError;
    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: isManual ? "No active templates found." : "No templates due today." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const candidateProfileIds = Array.from(
      new Set(
        [
          currentUserId,
          ...templates.flatMap((tpl) => [tpl.created_by, tpl.admin_id].filter(Boolean)),
        ]
          .filter(Boolean)
      )
    );

    const { data: profileRows } = candidateProfileIds.length
      ? await supabase.from("profiles").select("id").in("id", candidateProfileIds)
      : { data: [] };

    const validProfileIds = new Set((profileRows || []).map((profile) => profile.id));

    let processed = 0;

    for (const tpl of templates) {
      // Check if already generated this period
      if (tpl.last_generated) {
        const lastGen = new Date(tpl.last_generated);
        const lastGenMonth = lastGen.toISOString().slice(0, 7);

        if (tpl.interval === "monthly" && lastGenMonth === currentMonth) continue;
        if (tpl.interval === "fortnightly") {
          const daysSince = (today.getTime() - lastGen.getTime()) / (1000 * 3600 * 24);
          if (daysSince < 13) continue;
        }
        if (tpl.interval === "quarterly") {
          const monthsDiff =
            (today.getFullYear() - lastGen.getFullYear()) * 12 +
            (today.getMonth() - lastGen.getMonth());
          if (monthsDiff < 3) continue;
        }
        if (tpl.interval === "yearly") {
          const monthsDiff =
            (today.getFullYear() - lastGen.getFullYear()) * 12 +
            (today.getMonth() - lastGen.getMonth());
          if (monthsDiff < 12) continue;
        }
      }

      const dueDate = getISTDateString();
      const validCreatedBy = [tpl.created_by, tpl.admin_id, currentUserId].find(
        (profileId) => profileId && validProfileIds.has(profileId)
      ) || null;

      if (tpl.type === "fee" && tpl.student_id) {
        const { error } = await supabase.from("fees").insert({
          student_id: tpl.student_id,
          amount: tpl.amount,
          due_date: dueDate,
          status: "pending",
          notes: tpl.notes || "Auto-generated from recurring template",
        });
        if (error) {
          console.error("Fee insert error:", error);
          continue;
        }
      } else if (tpl.type === "salary" && tpl.teacher_id) {
        if (!validCreatedBy) {
          console.error("Salary skipped: no valid creator profile", tpl.id);
          continue;
        }

        const monthDate = `${currentMonth}-01`;
        const { error } = await supabase.from("teacher_salaries").insert({
          teacher_id: tpl.teacher_id,
          amount: tpl.amount,
          month: monthDate,
          status: "pending",
          created_by: validCreatedBy,
          notes: tpl.notes || "Auto-generated from recurring template",
        });
        if (error) {
          console.error("Salary insert error:", error);
          continue;
        }
      } else if (tpl.type === "expense") {
        if (!validCreatedBy) {
          console.error("Expense skipped: no valid creator profile", tpl.id);
          continue;
        }

        const { error } = await supabase.from("expenses").insert({
          amount: tpl.amount,
          category: tpl.category || "other",
          description: tpl.notes || "Auto-generated recurring expense",
          date: dueDate,
          created_by: validCreatedBy,
          admin_id: tpl.admin_id && validProfileIds.has(tpl.admin_id) ? tpl.admin_id : null,
        });
        if (error) {
          console.error("Expense insert error:", error);
          continue;
        }
      } else {
        continue;
      }

      // Update last_generated
      await supabase
        .from("recurring_templates")
        .update({ last_generated: dueDate })
        .eq("id", tpl.id);

      processed++;
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${processed} recurring template(s).`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
