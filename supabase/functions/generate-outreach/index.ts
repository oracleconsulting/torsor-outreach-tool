import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"

interface GenerateOutreachRequest {
  practiceId: string
  companyNumber: string
  format: 'email_intro' | 'formal_letter' | 'linkedin_connect' | 'linkedin_message' | 'warm_intro'
  tone: 'formal' | 'professional' | 'friendly'
  triggerEvent?: any
  networkConnection?: any
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const request: GenerateOutreachRequest = await req.json()

    if (!request.practiceId || !request.companyNumber || !request.format || !request.tone) {
      return new Response(
        JSON.stringify({ error: 'practiceId, companyNumber, format, and tone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Gather all context
    const companyResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: 'getCompany',
        companyNumber: request.companyNumber,
      }),
    })

    if (!companyResponse.ok) {
      throw new Error('Failed to fetch company data')
    }

    const company = await companyResponse.json()

    // Get officers
    const officersResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: 'getCompanyOfficers',
        companyNumber: request.companyNumber,
        includeResigned: false,
      }),
    })

    const officers = officersResponse.ok ? await officersResponse.json() : []

    // Get practice info
    const { data: practice } = await supabase
      .from('practices')
      .select('name')
      .eq('id', request.practiceId)
      .single()

    // Get fit score if available
    const { data: fitScore } = await supabase
      .from('outreach.prospect_fit_scores')
      .select('*')
      .eq('practice_id', request.practiceId)
      .eq('company_number', request.companyNumber)
      .single()

    // Build context
    const context = {
      company: {
        name: company.company_name,
        number: request.companyNumber,
        sector: company.sic_codes?.[0],
        status: company.company_status,
        address: company.registered_office_address,
        turnover: company.accounts?.last_accounts?.turnover,
      },
      directors: officers.slice(0, 3).map((o: any) => ({
        name: o.name,
        role: o.officer_role,
      })),
      practice: {
        name: practice?.name || 'our practice',
      },
      triggerEvent: request.triggerEvent,
      networkConnection: request.networkConnection,
      fitScore: fitScore ? {
        overall: fitScore.overall_fit,
        sector: fitScore.sector_fit,
      } : null,
    }

    // Build prompt based on format
    const formatPrompts: Record<string, string> = {
      email_intro: `Write a cold email introduction for ${context.company.name} (${context.company.number}).

Company details:
- Sector: ${context.company.sector || 'Unknown'}
- Status: ${context.company.status}
${context.directors.length > 0 ? `- Directors: ${context.directors.map((d: any) => d.name).join(', ')}` : ''}
${context.triggerEvent ? `- Trigger: ${context.triggerEvent.event_type} - ${JSON.stringify(context.triggerEvent.event_data)}` : ''}
${context.networkConnection ? `- Connection: ${context.networkConnection.connection_path?.join(' → ')}` : ''}

Tone: ${request.tone}
Length: Under 150 words
Include: Specific reference to their business, value proposition, low-commitment CTA

Return JSON:
{
  "subject": "email subject line",
  "body": "email body text",
  "personalizationPoints": ["point1", "point2"]
}`,

      formal_letter: `Write a formal business letter for ${context.company.name}.

Address to: ${context.directors[0]?.name || 'Director'}

Company: ${context.company.name} (${context.company.number})
Sector: ${context.company.sector || 'Unknown'}

Tone: Formal, professional
Format: Proper business letter with greeting and sign-off
Length: 2-3 paragraphs

Return JSON:
{
  "body": "letter text with proper formatting",
  "personalizationPoints": ["point1", "point2"]
}`,

      linkedin_connect: `Write a LinkedIn connection request message for ${context.directors[0]?.name || 'the director'} at ${context.company.name}.

${context.networkConnection ? `Connection: ${context.networkConnection.connection_path?.join(' → ')}` : ''}
${context.triggerEvent ? `Context: ${context.triggerEvent.event_type}` : ''}

Maximum 300 characters. No sales pitch, just connection.

Return JSON:
{
  "body": "connection request message",
  "personalizationPoints": ["point1"]
}`,

      warm_intro: `Write a warm introduction message referencing the shared connection.

Connection: ${context.networkConnection?.connection_path?.join(' → ') || 'Unknown'}
Your client: ${context.networkConnection?.source_client_name || 'Client'}
Target: ${context.company.name}

Tone: ${request.tone}
Make the connection feel natural and helpful.

Return JSON:
{
  "body": "warm introduction message",
  "personalizationPoints": ["point1", "point2"]
}`,
    }

    const prompt = formatPrompts[request.format] || formatPrompts.email_intro

    // Call OpenRouter
    const aiResponse = await fetch(OPENROUTER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': SUPABASE_URL,
        'X-Title': 'Torsor Outreach Tool',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          {
            role: 'system',
            content: 'You are a business development writer for a UK accounting practice. Write compelling, personalised outreach that feels genuine, not templated. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    if (!aiResponse.ok) {
      throw new Error(`AI generation failed: ${aiResponse.statusText}`)
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices[0]?.message?.content || ''

    // Extract JSON from response
    let result: any
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1])
      } else {
        const braceMatch = content.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          result = JSON.parse(braceMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      }
    } catch (error) {
      // Fallback: return raw content
      result = {
        body: content,
        subject: request.format === 'email_intro' ? 'Introduction' : undefined,
        personalizationPoints: [],
      }
    }

    // Save draft to database
    const { data: draft } = await supabase
      .from('outreach.outreach_drafts')
      .insert({
        practice_id: request.practiceId,
        company_number: request.companyNumber,
        format: request.format,
        tone: request.tone,
        subject: result.subject,
        body: result.body || content,
        personalization_points: result.personalizationPoints || [],
        ai_model: 'claude-sonnet-4',
      })
      .select()
      .single()

    return new Response(
      JSON.stringify({
        format: request.format,
        subject: result.subject,
        body: result.body || content,
        personalizationPoints: result.personalizationPoints || [],
        suggestedSendDate: new Date().toISOString(),
        draftId: draft?.id,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

