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

    const { students, mode = "create" } = await req.json();
    if (!Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "No students provided" }), {
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

    for (const student of students) {
      try {
        const { full_name, email, phone, class: studentClass, section, stream } = student;

        if (!full_name || !email) {
          errors.push(`Missing name or email for entry`);
          failed++;
          continue;
        }

        if (mode === "upsert") {
          // Check if user already exists
          const { data: existingUsers } = await adminClient.auth.admin.listUsers();
          const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

          if (existingUser) {
            // Update existing student record
            const { data: studentRecord } = await adminClient
              .from("students")
              .select("id")
              .eq("user_id", existingUser.id)
              .maybeSingle();

            if (studentRecord) {
              const updateData: Record<string, any> = {};
              if (studentClass) updateData.class = studentClass;
              if (section) updateData.section = section;
              if (stream) updateData.stream = stream;

              if (Object.keys(updateData).length > 0) {
                await adminClient.from("students").update(updateData).eq("id", studentRecord.id);
              }

              if (phone) {
                await adminClient.from("profiles").update({ phone }).eq("id", existingUser.id);
              }

              updated++;
              continue;
            }
          }
        }

        // Create new auth user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { full_name, role: "student" },
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

        if (studentClass || section || stream) {
          await adminClient
            .from("students")
            .update({
              ...(studentClass ? { class: studentClass } : {}),
              ...(section ? { section } : {}),
              ...(stream ? { stream } : {}),
            })
            .eq("user_id", newUserId);
        }

        created++;
      } catch (err: any) {
        errors.push(`${student.email || "unknown"}: ${err.message}`);
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
