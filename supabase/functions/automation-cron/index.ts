// Dispatcher invoked by pg_cron. Reads automation_settings rows and, when
// schedule conditions are met, triggers the matching backend task.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Setting {
  id: string;
  task_key: string;
  enabled: boolean;
  frequency: string;
  day_of_month: number;
  day_of_week: number;
}

function dueNow(s: Setting, now: Date): boolean {
  if (!s.enabled) return false;
  if (s.frequency === "daily") return true;
  if (s.frequency === "weekly") return now.getUTCDay() === s.day_of_week;
  if (s.frequency === "monthly") return now.getUTCDate() === s.day_of_month;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: settings, error } = await supabase
      .from("automation_settings")
      .select("*");
    if (error) throw error;

    const now = new Date();
    const dispatched: string[] = [];

    for (const s of (settings || []) as Setting[]) {
      if (!dueNow(s, now)) continue;

      // Map task_key -> edge function name
      const fn =
        s.task_key === "generate_fees" || s.task_key === "generate_salaries"
          ? "generate-recurring"
          : null;
      if (!fn) continue;

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ task: s.task_key }),
      });
      const txt = await resp.text();
      console.log(`dispatched ${s.task_key} -> ${fn}: ${resp.status} ${txt}`);
      dispatched.push(s.task_key);
    }

    return new Response(JSON.stringify({ ok: true, dispatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
