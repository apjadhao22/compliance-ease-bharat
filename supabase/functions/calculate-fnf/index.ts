import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRATUITY_MAX_LIMIT = 2000000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { basicSalary, unavailedLeaves, yearsOfService, arrears, bonus, noticeRecovery, loans, otherDeds } = await req.json();

    const basic = Number(basicSalary || 0);
    const leaves = Number(unavailedLeaves || 0);
    const years = Number(yearsOfService || 0);

    // Leave Encashment
    let leaveEncash = 0;
    if (leaves > 0) {
      leaveEncash = Math.round((basic / 26) * leaves);
    }

    // Gratuity
    let gratuity = 0;
    if (years >= 5) {
      gratuity = Math.round((basic * 15 * years) / 26);
      if (gratuity > GRATUITY_MAX_LIMIT) {
        gratuity = GRATUITY_MAX_LIMIT;
      }
    }

    // Totals
    const totalEarnings = leaveEncash + gratuity + (Number(arrears) || 0) + (Number(bonus) || 0);
    const totalDeductions = (Number(noticeRecovery) || 0) + (Number(loans) || 0) + (Number(otherDeds) || 0);
    const netPayable = totalEarnings - totalDeductions;

    return new Response(JSON.stringify({
      leave_encashment: leaveEncash,
      gratuity_amount: gratuity,
      net_payable: netPayable
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
