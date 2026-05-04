// Generates fees and teacher salaries from recurring_templates.
// Idempotent per (template, period). Safe to invoke multiple times per day.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Template {
  id: string;
  type: "fee" | "salary";
  amount: number;
  interval: string; // monthly | weekly | daily
  day_of_month: number;
  student_id: string | null;
  teacher_id: string | null;
  admin_id: string | null;
  category: string | null;
  notes: string | null;
  is_active: boolean;
  last_generated: string | null;
  created_by: string;
}

function shouldGenerate(t: Template, now: Date): boolean {
  if (!t.is_active) return false;
  if (t.interval === "monthly") {
    if (now.getUTCDate() !== t.day_of_month) return false;
    if (!t.last_generated) return true;
    const last = new Date(t.last_generated);
    return (
      last.getUTCFullYear() !== now.getUTCFullYear() ||
      last.getUTCMonth() !== now.getUTCMonth()
    );
  }
  if (t.interval === "weekly") {
    if (!t.last_generated) return true;
    const last = new Date(t.last_generated);
    return now.getTime() - last.getTime() >= 7 * 86400_000;
  }
  if (t.interval === "daily") {
    if (!t.last_generated) return true;
    const last = new Date(t.last_generated);
    return last.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: templates, error } = await supabase
      .from("recurring_templates")
      .select("*")
      .eq("is_active", true);
    if (error) throw error;

    const now = new Date();
    const dueDateStr = now.toISOString().slice(0, 10);
    const monthLabel = now.toISOString().slice(0, 7); // YYYY-MM

    let feesCreated = 0;
    let salariesCreated = 0;
    const notifications: any[] = [];

    for (const t of (templates || []) as Template[]) {
      if (!shouldGenerate(t, now)) continue;

      if (t.type === "fee" && t.student_id) {
        const { error: feeErr } = await supabase.from("fees").insert({
          student_id: t.student_id,
          amount: t.amount,
          due_date: dueDateStr,
          status: "pending",
          notes: t.notes ?? `Auto-generated from template ${t.id}`,
        });
        if (!feeErr) {
          feesCreated++;
          const { data: stud } = await supabase
            .from("students")
            .select("user_id")
            .eq("id", t.student_id)
            .maybeSingle();
          if (stud?.user_id) {
            notifications.push({
              user_id: stud.user_id,
              title: "New fee added",
              message: `A fee of ₹${t.amount} is due on ${dueDateStr}.`,
              type: "fee",
            });
          }
        } else console.error("fee insert", feeErr);
      } else if (t.type === "salary" && t.teacher_id) {
        const { error: salErr } = await supabase.from("teacher_salaries").insert({
          teacher_id: t.teacher_id,
          amount: t.amount,
          month: monthLabel,
          status: "pending",
          notes: t.notes ?? `Auto-generated from template ${t.id}`,
          created_by: t.created_by,
        });
        if (!salErr) {
          salariesCreated++;
          const { data: tea } = await supabase
            .from("teachers")
            .select("user_id")
            .eq("id", t.teacher_id)
            .maybeSingle();
          if (tea?.user_id) {
            notifications.push({
              user_id: tea.user_id,
              title: "Salary scheduled",
              message: `Your salary of ₹${t.amount} for ${monthLabel} is pending.`,
              type: "salary",
            });
          }
        } else console.error("salary insert", salErr);
      }

      await supabase
        .from("recurring_templates")
        .update({ last_generated: now.toISOString() })
        .eq("id", t.id);
    }

    if (notifications.length) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        fees_created: feesCreated,
        salaries_created: salariesCreated,
        notifications: notifications.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
