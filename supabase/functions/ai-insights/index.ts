// Admin-only AI insights via Lovable AI Gateway.
// Aggregates fees / attendance / expenses and asks the model for actionable insights.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await userClient.rpc("is_admin");
    const { data: isCo } = await userClient.rpc("is_co_admin");
    if (!isAdmin && !isCo) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const [feesRes, attRes, expRes, studRes] = await Promise.all([
      admin.from("fees").select("amount, status, due_date"),
      admin.from("attendance").select("status, date"),
      admin.from("expenses").select("amount, category, date"),
      admin.from("students").select("id"),
    ]);

    const fees = feesRes.data || [];
    const summary = {
      students: studRes.data?.length || 0,
      fees_total: fees.reduce((s, f: any) => s + Number(f.amount), 0),
      fees_pending: fees.filter((f: any) => f.status === "pending").reduce((s, f: any) => s + Number(f.amount), 0),
      fees_overdue: fees.filter((f: any) => f.status === "overdue").reduce((s, f: any) => s + Number(f.amount), 0),
      attendance_present: attRes.data?.filter((a: any) => a.status === "present").length || 0,
      attendance_absent: attRes.data?.filter((a: any) => a.status === "absent").length || 0,
      expenses_total: expRes.data?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0,
      expense_categories: Object.entries(
        (expRes.data || []).reduce((acc: Record<string, number>, e: any) => {
          acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
          return acc;
        }, {}),
      ),
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an academy operations analyst. Given a JSON summary, return 3-6 short, specific, actionable insights with priorities. Use plain English, currency in INR (₹).",
          },
          { role: "user", content: JSON.stringify(summary) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_insights",
            description: "Return prioritized insights for the academy admin.",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      category: { type: "string", enum: ["fees", "attendance", "expenses", "general"] },
                    },
                    required: ["title", "detail", "priority", "category"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_insights" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let insights: any[] = [];
    if (toolCall?.function?.arguments) {
      try { insights = JSON.parse(toolCall.function.arguments).insights || []; } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({ summary, insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
