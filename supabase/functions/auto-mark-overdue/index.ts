import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Get current date in IST (UTC+5:30) as YYYY-MM-DD */
const getISTDateString = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString().split("T")[0];
};

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
      .eq("task_key", "auto-mark-overdue")
      .single();

    const isManual = req.headers.get("x-manual-trigger") === "true";
    if (!isManual && automationSetting && !automationSetting.enabled) {
      return new Response(
        JSON.stringify({ message: "Task is disabled.", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = getISTDateString();

    // Update all pending fees where due_date is past
    const { data, error } = await supabase
      .from("fees")
      .update({ status: "overdue" })
      .eq("status", "pending")
      .lt("due_date", today)
      .select("id");

    if (error) throw error;

    const count = data?.length || 0;

    return new Response(
      JSON.stringify({ message: `Marked ${count} fee(s) as overdue`, count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
