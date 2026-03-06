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
    const systemPrompt = `You are a strict Indian Statutory Payroll Auditor.
    The company is operating under: ${regimeContext}.
    
    You will receive a JSON array of drafted payroll slips. 
    Analyze the math and flag any statutory violations, anomalies, or suspicious patterns.
    
    If operating under Labour Codes, you MUST flag any employee whose (basic_salary) is less than 50% of their (gross_pay).
    If operating under Legacy Acts, flag any unusually low Basic salaries (e.g., minimum wage risks).
    Flag if PF deductions look incorrect (usually 12% of basic up to 15,000 ceiling, or 1800 flat).
    
    Return ONLY a JSON array of anomalies. Do not return markdown, just the raw JSON array.
    Format your response EXACTLY like this:
    [
      { "employee_name": "John Doe", "severity": "critical", "issue": "Basic salary is only 40% of Gross, violating the 50% Wage Code rule." },
      { "employee_name": "Jane Smith", "severity": "warning", "issue": "PF deduction of 0 seems incorrect for a regular active employee." }
    ]
    If the payroll is perfectly compliant, return an empty array: []`

    // 3. Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(payrollData) }
        ],
        temperature: 0.1,
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
