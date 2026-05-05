import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authorization: verify the caller is admin or co-admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [isAdminResult, isCoAdminResult] = await Promise.all([
      userClient.rpc("is_admin"),
      userClient.rpc("is_co_admin"),
    ]);

    if (!isAdminResult.data && !isCoAdminResult.data) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for data fetching
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch analytics data
    const [studentsResult, teachersResult, rolesResult, feesResult, expensesResult, classesResult, attendanceResult] = await Promise.all([
      supabase.from("students").select("id, user_id"),
      supabase.from("teachers").select("user_id"),
      supabase.from("user_roles").select("user_id").in("role", ["admin", "co_admin"]),
      supabase.from("fees").select("amount, status, due_date"),
      supabase.from("expenses").select("amount, category, date"),
      supabase.from("classes").select("*", { count: "exact" }),
      supabase.from("attendance").select("status"),
    ]);

    // Filter out teachers, admins, co-admins, and get accurate student count
    const teacherUserIds = new Set((teachersResult.data || []).map(t => t.user_id));
    const adminUserIds = new Set((rolesResult.data || []).map(r => r.user_id));
    const actualStudents = (studentsResult.data || []).filter(
      s => s.user_id && !teacherUserIds.has(s.user_id) && !adminUserIds.has(s.user_id)
    );
    const totalStudents = actualStudents.length;
    const totalClasses = classesResult.count || 0;

    const paidFees = feesResult.data?.filter(f => f.status === "paid") || [];
    const pendingFees = feesResult.data?.filter(f => f.status === "pending") || [];
    const overdueFees = feesResult.data?.filter(f => f.status === "overdue") || [];
    
    const totalRevenue = paidFees.reduce((sum, fee) => sum + Number(fee.amount), 0);
    const pendingAmount = pendingFees.reduce((sum, fee) => sum + Number(fee.amount), 0);
    const overdueAmount = overdueFees.reduce((sum, fee) => sum + Number(fee.amount), 0);

    const expenses = expensesResult.data || [];
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    
    const expensesByCategory: Record<string, number> = {};
    expenses.forEach(exp => {
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + Number(exp.amount);
    });

    const attendanceRecords = attendanceResult.data || [];
    const presentCount = attendanceRecords.filter(a => a.status === "present").length;
    const totalAttendance = attendanceRecords.length;
    const attendanceRate = totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(1) : 0;

    const netProfit = totalRevenue - totalExpenses;

    const analyticsContext = `
Tuition Center Analytics Summary:
- Total Students: ${totalStudents}
- Total Classes: ${totalClasses}
- Total Revenue (Paid Fees): ₹${totalRevenue.toLocaleString()}
- Pending Fees: ₹${pendingAmount.toLocaleString()} (${pendingFees.length} students)
- Overdue Fees: ₹${overdueAmount.toLocaleString()} (${overdueFees.length} students)
- Total Expenses: ₹${totalExpenses.toLocaleString()}
- Net Profit: ₹${netProfit.toLocaleString()}
- Expenses by Category: ${JSON.stringify(expensesByCategory)}
- Average Attendance Rate: ${attendanceRate}%
- Collection Rate: ${feesResult.data?.length ? ((paidFees.length / feesResult.data.length) * 100).toFixed(1) : 0}%
`;

    console.log("Analytics context:", analyticsContext);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a business analytics assistant for a tuition center called 4D Academy. Analyze the provided data and generate actionable insights and recommendations. Be concise, specific, and practical.

IMPORTANT HEALTH SCORING GUIDELINES:
- If the business is profitable (net profit > 0), the healthScore MUST be at least 60.
- A profitable business with good collection rates should score 70-85.
- Only score below 50 if the business is operating at a loss.
- The "trend" should reflect financial direction: if profitable, use "up" or "stable", never "down".
- Small but profitable early-stage operations should be assessed positively — growth potential is a strength, not a weakness.
- Focus on actionable improvements rather than penalizing small scale.

Format your response as JSON with the following structure:
{
  "summary": "A brief 1-2 sentence overview of the business health",
  "insights": [
    {"title": "Insight title", "description": "Detailed insight", "type": "positive|warning|info"}
  ],
  "recommendations": [
    {"title": "Recommendation title", "description": "Actionable recommendation", "priority": "high|medium|low"}
  ],
  "keyMetrics": {
    "healthScore": number between 0-100,
    "trend": "up|down|stable"
  }
}
Provide 3-5 insights and 3-4 recommendations based on the data.`
          },
          {
            role: "user",
            content: analyticsContext
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    
    console.log("AI response content:", content);

    let parsedInsights;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      parsedInsights = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      parsedInsights = {
        summary: "Analysis completed. Review your metrics for detailed insights.",
        insights: [
          { title: "Data Analysis", description: content, type: "info" }
        ],
        recommendations: [],
        keyMetrics: { healthScore: 75, trend: "stable" }
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...parsedInsights,
        rawMetrics: {
          totalStudents,
          totalClasses,
          totalRevenue,
          pendingAmount,
          overdueAmount,
          totalExpenses,
          netProfit,
          attendanceRate,
          expensesByCategory
        }
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Analytics error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
