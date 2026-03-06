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
    const { message, history } = await req.json()
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    
    // 1. Get user and company context securely using the auth token
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

    // 2. Build the System Prompt with context
    const stateContext = company?.state || "India"
    const regimeContext = company?.compliance_regime === "labour_codes" ? "The New Four Labour Codes" : "Legacy Labour Acts"
    
    const systemPrompt = `You are the ultimate HR and Statutory Compliance Copilot for ComplianceEngine.
    You are advising an HR manager or Director in India.
    CRITICAL CONTEXT:
    - The company is operating in: ${stateContext}. Customise answers around LWF, Minimum Wages, PT based on this state.
    - The company is operating under: ${regimeContext}. 
      If Labour Codes, enforce the 50% wage rule and 30-day leave encashment limits.
      If Legacy Acts, default to standard EPF, ESIC, and Payment of Bonus Acts rules.
    Be concise, highly accurate, and helpful. Format your answers neatly using bullet points where appropriate.`

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
          ...(history || []),
          { role: 'user', content: message }
        ],
        temperature: 0.0,
      }),
    })

    const data = await response.json()
    const reply = data.choices[0].message.content

    return new Response(JSON.stringify({ reply }), {
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
