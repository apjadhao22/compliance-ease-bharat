import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth client — caller must be admin/owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular client (caller's JWT) to verify role
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Service role client for admin auth operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { employeeId } = await req.json();
    if (!employeeId) {
      return new Response(JSON.stringify({ error: "employeeId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get calling user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the employee
    const { data: employee, error: empError } = await adminClient
      .from("employees")
      .select("id, email, company_id, name")
      .eq("id", employeeId)
      .single();

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: "Employee not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!employee.email) {
      return new Response(JSON.stringify({ error: "Employee has no email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin/owner for this company
    const { data: membership, error: memberError } = await adminClient
      .from("company_members")
      .select("role")
      .eq("company_id", employee.company_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || !["owner", "admin", "hr"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invite user by email via Supabase Auth
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      employee.email,
      {
        data: {
          role: "employee",
          employee_id: employee.id,
        },
        redirectTo: `${Deno.env.get("SITE_URL") ?? "http://localhost:5173"}/ess`,
      }
    );

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update ess_invited_at
    await adminClient
      .from("employees")
      .update({ ess_invited_at: new Date().toISOString() })
      .eq("id", employeeId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
