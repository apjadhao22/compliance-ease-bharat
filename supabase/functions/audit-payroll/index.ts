import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { payrollData } = await req.json()
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    
    // 1. Get user and company context securely
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: company } = await supabaseClient
      .from("companies")
      .select("state, compliance_regime")
      .eq("user_id", user.id)
      .maybeSingle()

    const regimeContext = company?.compliance_regime === "labour_codes" 
      ? "The New Four Labour Codes (where Basic + DA must be >= 50% of Gross Pay)" 
      : "Legacy Labour Acts"

    // 2. Build the System Prompt
    const systemPrompt = `You are a strict, highly analytical Indian Statutory Payroll Auditor.
    The company is operating under: ${regimeContext}.
    
    You will receive a JSON array of drafted payroll slips. 
    Analyze the data and flag ANY statutory violations, anomalies, or suspicious patterns based on Indian Labour Laws.
    
    You MUST check for the following compliance aspects:
    1. 50% Wage Rule (If Labour Codes): Flag ONLY if (basic) is LESS THAN 50% of (gross). If (basic) is >= 50% of (gross) (e.g., 60%, 66%, 100%), it is COMPLIANT and MUST NOT be flagged!
    2. Minimum Wages Compliance: Flag if the Basic Pay seems extraordinarily low (e.g., < ₹9,000 for full month).
    3. Official Holidays & Weekends: Flag if "days_worked" exceeds the total working days in a month minus statutory weekends/holidays (e.g. >26 days without OT).
    4. Date of Payment SLA: Verify (conceptually) if the payout date adheres to the Payment of Wages Act (7th or 10th depending on headcount).
    5. Overtime (OT) Policy Adherence: Flag if OT pay is abnormally high compared to Basic, or if it violates standard 2x wage rules or weekly limits.
    6. LWF (Labour Welfare Fund): Determine if LWF deductions are missing when they should be applied (usually June/Dec depending on state).
    7. Professional Tax (PT): Flag if PT is suspiciously 0 for high-grossing employees where state PT slabs usually apply (e.g. > ₹10,000 gross).
    8. Equal Remuneration: If genders and roles are present, flag any obvious anomalies where identical roles have wildly different Basic Pays.
    
    OUTPUT FORMAT:
    Return ONLY a JSON array of anomalies. Do not return markdown, just the raw JSON config.
    Format your response EXACTLY like this:
    [
      { "employee_name": "John Doe", "severity": "critical", "issue": "Basic salary is only 40% of Gross, violating the 50% Wage Code rule." },
      { "employee_name": "Jane Smith", "severity": "warning", "issue": "Days worked (28) exceeds standard 26-day maximum without corresponding Overtime." }
    ]
    
    If ALL CHECKS PASS and the payroll is perfectly compliant, you MUST return an array with exactly ONE object confirming success, structured like this:
    [
      { "employee_name": "System Status", "severity": "success", "issue": "All statutory checks passed successfully! Minimum wages, PT, LWF, OT, and 50% wage rules are compliant." }
    ]`

    // 3. Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payrollData) }
        ],
        temperature: 0.0,
      }),
    })

    const data = await response.json()
    let reply = data.choices[0].message.content
    
    // Clean up potential markdown formatting from the response
    if (reply.startsWith('```json')) {
      reply = reply.replace(/```json\n?/, '').replace(/```\n?$/, '')
    }

    const anomalies = JSON.parse(reply.trim())

    return new Response(JSON.stringify({ anomalies }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
