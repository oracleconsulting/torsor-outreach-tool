import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "perplexity/sonar-deep-research"

interface EnrichmentRequest {
  operation: 'find' | 'confirm'
  companyName: string
  companyNumber: string
  registeredAddress?: string
  addressToConfirm?: {
    line1: string
    line2?: string
    town: string
    postcode: string
  }
  directorName?: string
  principalActivity?: string
  sicCode?: string
}

async function callPerplexity(prompt: string): Promise<string> {
  const response = await fetch(OPENROUTER_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': Deno.env.get('SUPABASE_URL') || 'https://supabase.com',
      'X-Title': 'Torsor Outreach Tool',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that finds and verifies UK business addresses. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

function extractJsonFromResponse(text: string): any {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1])
  }

  // Try to find JSON object in text
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    return JSON.parse(braceMatch[0])
  }

  throw new Error('Could not extract JSON from response')
}

async function handleFindOperation(request: EnrichmentRequest): Promise<Response> {
  const prompt = `Find the actual trading/office address for:

Company: ${request.companyName}
Company Number: ${request.companyNumber}
${request.principalActivity ? `Business: ${request.principalActivity}` : ''}
${request.directorName ? `Director: ${request.directorName}` : ''}

Their registered office is: ${request.registeredAddress || 'Not provided'}
(This appears to be an accountant/virtual office - we need their REAL business address)

Search for:
1. Company website contact/location pages
2. Google Maps business listings
3. Business directories (Yell, Thomson Local)
${request.sicCode?.startsWith('68') ? '4. Estate agent listings (Rightmove, Zoopla)' : ''}

Return JSON:
{
  "found": true/false,
  "addresses": [
    {
      "line1": "street address",
      "line2": "optional",
      "town": "city/town",
      "postcode": "postcode",
      "type": "trading",
      "source": "website/google maps/directory",
      "sourceUrl": "url if available",
      "confidence": 0-100
    }
  ],
  "notes": "observations about the search"
}`

  try {
    const response = await callPerplexity(prompt)
    const result = extractJsonFromResponse(response)

    const bestAddress = result.addresses?.[0] || null
    const avgConfidence = result.addresses?.length > 0
      ? Math.round(result.addresses.reduce((sum: number, a: any) => sum + (a.confidence || 0), 0) / result.addresses.length)
      : 0

    return new Response(
      JSON.stringify({
        success: result.found === true,
        operation: 'find',
        addresses: result.addresses || [],
        bestAddress,
        confidence: avgConfidence,
        notes: result.notes,
        sources: result.addresses?.map((a: any) => a.sourceUrl).filter(Boolean) || [],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        operation: 'find',
        addresses: [],
        confidence: 0,
        notes: `Error: ${error.message}`,
        sources: [],
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handleConfirmOperation(request: EnrichmentRequest): Promise<Response> {
  if (!request.addressToConfirm) {
    return new Response(
      JSON.stringify({ error: 'addressToConfirm is required for confirm operation' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const addr = request.addressToConfirm
  const addressStr = `${addr.line1}, ${addr.line2 || ''}, ${addr.town}, ${addr.postcode}`.replace(/, ,/g, ',')

  const prompt = `Verify this business address for ${request.companyName} (${request.companyNumber}):

ADDRESS TO VERIFY: ${addressStr}

Please confirm:
1. Is this address shown on their official website?
2. Does Google Maps show this business at this location?
3. Is this a known virtual office address?
4. Is there any evidence this address is outdated or incorrect?
5. If this address is wrong, what is their actual address?

Return JSON:
{
  "confirmed": true/false,
  "result": "confirmed" | "likely_valid" | "suspicious" | "invalid" | "unknown",
  "details": {
    "foundOnWebsite": true/false,
    "websiteUrl": "url or null",
    "foundOnGoogleMaps": true/false,
    "googleMapsVerified": true/false,
    "isVirtualOffice": true/false,
    "virtualOfficeProvider": "provider name or null",
    "isOutdated": true/false,
    "outdatedReason": "reason or null",
    "alternativeAddress": {
      "line1": "...",
      "town": "...",
      "postcode": "..."
    } or null,
    "sources": ["url1", "url2"]
  },
  "confidence": 0-100,
  "notes": "additional observations"
}`

  try {
    const response = await callPerplexity(prompt)
    const result = extractJsonFromResponse(response)

    return new Response(
      JSON.stringify({
        success: result.confirmed === true || result.result === 'confirmed' || result.result === 'likely_valid',
        operation: 'confirm',
        confirmationResult: result.result || 'unknown',
        confirmationDetails: {
          foundOnWebsite: result.details?.foundOnWebsite || false,
          websiteUrl: result.details?.websiteUrl || undefined,
          foundOnGoogleMaps: result.details?.foundOnGoogleMaps || false,
          googleMapsVerified: result.details?.googleMapsVerified || false,
          isVirtualOffice: result.details?.isVirtualOffice || false,
          virtualOfficeProvider: result.details?.virtualOfficeProvider || undefined,
          isOutdated: result.details?.isOutdated || false,
          outdatedReason: result.details?.outdatedReason || undefined,
          alternativeAddress: result.details?.alternativeAddress || undefined,
          sources: result.details?.sources || [],
        },
        confidence: result.confidence || 0,
        notes: result.notes,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        operation: 'confirm',
        confirmationResult: 'unknown',
        confirmationDetails: {
          foundOnWebsite: false,
          foundOnGoogleMaps: false,
          isVirtualOffice: false,
          isOutdated: false,
          sources: [],
        },
        confidence: 0,
        notes: `Error: ${error.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
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
    const request: EnrichmentRequest = await req.json()

    if (!request.operation || !['find', 'confirm'].includes(request.operation)) {
      return new Response(
        JSON.stringify({ error: 'Invalid operation. Must be "find" or "confirm"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.operation === 'find') {
      return handleFindOperation(request)
    } else {
      return handleConfirmOperation(request)
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

