import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AutomationSetting = {
  task_key: string;
  enabled: boolean;
  cron_expression: string;
  frequency: string;
  day_of_week: number;
  day_of_month: number;
};

const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset);
};

const parseCronTime = (cronExpression: string) => {
  const [minute = "0", hour = "0"] = cronExpression.split(" ");
  return {
    minute: Number.parseInt(minute, 10) || 0,
    hour: Number.parseInt(hour, 10) || 0,
  };
};

const shouldRunNow = (setting: AutomationSetting, now: Date) => {
  const { minute, hour } = parseCronTime(setting.cron_expression);
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDate();
  const currentWeekday = now.getUTCDay();
  const currentMonth = now.getUTCMonth() + 1;

  if (minute !== currentMinute || hour !== currentHour) return false;

  switch (setting.frequency) {
    case "weekly":
    case "fortnightly":
      return currentWeekday === setting.day_of_week;
    case "monthly":
      return currentDay === setting.day_of_month;
    case "quarterly":
      return currentDay === setting.day_of_month && [1, 4, 7, 10].includes(currentMonth);
    case "half_yearly":
      return currentDay === setting.day_of_month && [1, 7].includes(currentMonth);
    case "yearly":
      return currentDay === setting.day_of_month && currentMonth === 1;
    default:
      return true;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const isScheduler = token === serviceRoleKey || token === anonKey;

    if (!isScheduler) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: authHeader ? { Authorization: authHeader } : {} },
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = getISTDate();
    const { data: settings, error } = await supabase
      .from("automation_settings")
      .select("task_key, enabled, cron_expression, frequency, day_of_week, day_of_month")
      .eq("enabled", true);

    if (error) throw error;

    const dueTasks = (settings || []).filter((setting) => shouldRunNow(setting as AutomationSetting, now));

    if (dueTasks.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No automation tasks are due right now.",
          app_time_ist: now.toISOString(),
          due_tasks: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await Promise.all(
      dueTasks.map(async (task) => {
        const response = await fetch(`${supabaseUrl}/functions/v1/${task.task_key}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        const text = await response.text();

        return {
          task_key: task.task_key,
          ok: response.ok,
          status: response.status,
          response: text,
        };
      })
    );

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} due automation task(s).`,
        app_time_ist: now.toISOString(),
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});