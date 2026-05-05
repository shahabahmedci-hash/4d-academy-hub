import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
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

    const { teachers, mode } = await req.json();
    const isUpsert = mode === "upsert";

    if (!Array.isArray(teachers) || teachers.length === 0) {
      return new Response(JSON.stringify({ error: "No teachers provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const teacher of teachers) {
      try {
        const { full_name, email, phone, designation, subjects } = teacher;

        if (!full_name || !email) {
          errors.push(`Missing name or email for entry`);
          failed++;
          continue;
        }

        // Check if user with this email already exists
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existingUser) {
          if (!isUpsert) {
            errors.push(`${email}: already exists (enable upsert to update)`);
            failed++;
            continue;
          }

          // Update existing teacher
          const userId = existingUser.id;

          // Update profile
          const profileUpdate: Record<string, any> = { full_name };
          if (phone) profileUpdate.phone = phone;
          await adminClient.from("profiles").update(profileUpdate).eq("id", userId);

          // Update teacher record
          const teacherUpdate: Record<string, any> = {};
          if (designation) teacherUpdate.designation = designation;
          if (subjects) {
            teacherUpdate.subjects = subjects.split(";").map((s: string) => s.trim()).filter(Boolean);
          }
          if (Object.keys(teacherUpdate).length > 0) {
            await adminClient.from("teachers").update(teacherUpdate).eq("user_id", userId);
          }

          updated++;
          continue;
        }

        // Create new user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name, role: "teacher" },
        });

        if (authError) {
          errors.push(`${email}: ${authError.message}`);
          failed++;
          continue;
        }

        const newUserId = authData.user.id;

        if (phone) {
          await adminClient.from("profiles").update({ phone }).eq("id", newUserId);
        }

        const teacherUpdate: Record<string, any> = {};
        if (designation) teacherUpdate.designation = designation;
        if (subjects) {
          teacherUpdate.subjects = subjects.split(";").map((s: string) => s.trim()).filter(Boolean);
        }
        if (Object.keys(teacherUpdate).length > 0) {
          await adminClient.from("teachers").update(teacherUpdate).eq("user_id", newUserId);
        }

        created++;
      } catch (err: any) {
        errors.push(`${teacher.email || "unknown"}: ${err.message}`);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ created, updated, failed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
