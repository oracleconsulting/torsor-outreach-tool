import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!

interface ConfirmAddressRequest {
  directorName: string
  address: string
  companyContext?: string
  providedAddress: {
    line1?: string
    line2?: string
    line3?: string
    town?: string
    postcode?: string
    country?: string
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { directorName, address, companyContext, providedAddress }: ConfirmAddressRequest = await req.json()

    if (!directorName || !address) {
      return new Response(
        JSON.stringify({ error: 'directorName and address are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build prompt for Perplexity to confirm director address
    let prompt = `I need to confirm the contact address (not registered office address) for a UK company director named "${directorName}".`
    
    if (companyContext) {
      prompt += ` They are a director of "${companyContext}".`
    }
    
    prompt += `\n\nThe address I have is: ${address}\n\n`
    
    prompt += `Please confirm if this is the correct contact/residential address for ${directorName}. `
    prompt += `If the address is correct, return it in a structured format. `
    prompt += `If it's incorrect or you find a better match, provide the correct address. `
    prompt += `IMPORTANT: This should be their personal/residential address, NOT the company's registered office address. `
    prompt += `Return ONLY a JSON object with this structure:\n`
    prompt += `{\n`
    prompt += `  "confirmed": true/false,\n`
    prompt += `  "confidence": "high" | "medium" | "low",\n`
    prompt += `  "address_line_1": "...",\n`
    prompt += `  "address_line_2": "..." (optional),\n`
    prompt += `  "locality": "...",\n`
    prompt += `  "postal_code": "...",\n`
    prompt += `  "country": "United Kingdom",\n`
    prompt += `  "notes": "Any relevant notes about the address"\n`
    prompt += `}\n\n`
    prompt += `If you cannot confirm the address, set "confirmed" to false and provide what information you found.`

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': Deno.env.get('SUPABASE_URL') || 'https://supabase.com',
        'X-Title': 'Torsor Director Address Confirmation',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-deep-research',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at finding and verifying UK company director contact information. You have access to Companies House data and can verify director addresses. Always distinguish between registered office addresses (company addresses) and personal/residential addresses (director contact addresses).',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more factual responses
        max_tokens: 500,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      throw new Error(`AI confirmation failed: ${aiResponse.statusText} - ${errorText}`)
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices[0]?.message?.content || ''

    // Extract JSON from response
    let result: any
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        // Fallback: try parsing entire content
        result = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      // Return provided address as fallback
      return new Response(
        JSON.stringify({
          confirmedAddress: {
            address_line_1: providedAddress.line1 || '',
            address_line_2: providedAddress.line2 || providedAddress.line3 || undefined,
            locality: providedAddress.town || '',
            postal_code: providedAddress.postcode || '',
            country: providedAddress.country || 'United Kingdom',
            confidence: 'low' as const,
          },
          note: 'AI confirmation failed, using provided address',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If confirmed, return structured address
    if (result.confirmed) {
      return new Response(
        JSON.stringify({
          confirmedAddress: {
            address_line_1: result.address_line_1 || providedAddress.line1 || '',
            address_line_2: result.address_line_2 || providedAddress.line2 || providedAddress.line3 || undefined,
            locality: result.locality || providedAddress.town || '',
            postal_code: result.postal_code || providedAddress.postcode || '',
            country: result.country || providedAddress.country || 'United Kingdom',
            confidence: result.confidence || 'medium',
          },
          notes: result.notes,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Not confirmed - return provided address with low confidence
      return new Response(
        JSON.stringify({
          confirmedAddress: {
            address_line_1: providedAddress.line1 || '',
            address_line_2: providedAddress.line2 || providedAddress.line3 || undefined,
            locality: providedAddress.town || '',
            postal_code: providedAddress.postcode || '',
            country: providedAddress.country || 'United Kingdom',
            confidence: 'low' as const,
          },
          note: result.notes || 'Address could not be confirmed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error confirming director address:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

