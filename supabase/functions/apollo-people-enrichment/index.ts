import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface PeopleEnrichmentRequest {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  organizationName?: string
  domain?: string
  linkedinUrl?: string
  revealPersonalEmails?: boolean
  revealPhoneNumber?: boolean
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const request: PeopleEnrichmentRequest = await req.json()

    // Validate required fields - need at least name or email
    if (!request.fullName && !request.firstName && !request.email) {
      return new Response(
        JSON.stringify({ error: 'At least one of fullName, firstName+lastName, or email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build request body for Apollo
    const apolloBody: any = {}
    
    if (request.fullName) {
      apolloBody.name = request.fullName
    } else if (request.firstName && request.lastName) {
      apolloBody.first_name = request.firstName
      apolloBody.last_name = request.lastName
    }
    
    if (request.email) {
      apolloBody.email = request.email
    }
    
    if (request.organizationName) {
      apolloBody.organization_name = request.organizationName
    }
    
    if (request.domain) {
      apolloBody.domain = request.domain
    }
    
    if (request.linkedinUrl) {
      apolloBody.linkedin_url = request.linkedinUrl
    }
    
    // Set reveal options (default to true for contact details)
    apolloBody.reveal_personal_emails = request.revealPersonalEmails !== false // Default true
    apolloBody.reveal_phone_number = request.revealPhoneNumber !== false // Default true

    // Call Apollo People Match API
    const response = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": APOLLO_API_KEY
      },
      body: JSON.stringify(apolloBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Apollo API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // Check if person was found
    if (!data.person) {
      return new Response(
        JSON.stringify({
          success: false,
          found: false,
          source: 'apollo',
          confidence: 0,
          notes: 'Person not found in Apollo database'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const person = data.person

    // Extract address from person data
    let address = null
    if (person.street_address || person.city || person.postal_code) {
      address = {
        line1: person.street_address || '',
        line2: person.street_address_2 || null,
        city: person.city || '',
        county: person.state || '',
        postcode: person.postal_code || '',
        country: person.country || 'United Kingdom'
      }
    }

    // Extract phone numbers
    const phoneNumbers = []
    if (person.phone_numbers && person.phone_numbers.length > 0) {
      phoneNumbers.push(...person.phone_numbers.map((p: any) => ({
        number: p.sanitized_number || p.raw_number,
        type: p.type || 'unknown',
        source: p.source
      })))
    }

    // Extract emails
    const emails = []
    if (person.email) {
      emails.push({
        email: person.email,
        type: 'work',
        verified: person.email_status === 'verified'
      })
    }
    if (person.personal_emails && person.personal_emails.length > 0) {
      emails.push(...person.personal_emails.map((e: any) => ({
        email: e,
        type: 'personal',
        verified: false
      })))
    }

    // Calculate confidence score
    let confidence = 30
    if (person.email) confidence += 20
    if (person.email_status === 'verified') confidence += 15
    if (address) confidence += 15
    if (person.phone_numbers && person.phone_numbers.length > 0) confidence += 10
    if (person.linkedin_url) confidence += 5
    if (person.title) confidence += 5
    confidence = Math.min(100, confidence)

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        source: 'apollo',
        person: {
          apolloId: person.id,
          firstName: person.first_name || '',
          lastName: person.last_name || '',
          fullName: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          title: person.title || null,
          organizationName: person.organization?.name || request.organizationName || null,
          organizationDomain: person.organization?.primary_domain || request.domain || null,
          linkedinUrl: person.linkedin_url || null,
          address,
          emails,
          phoneNumbers,
          verifiedEmail: person.email && person.email_status === 'verified' ? person.email : null,
          primaryPhone: phoneNumbers.length > 0 ? phoneNumbers[0].number : null,
        },
        confidence,
        notes: `Found via Apollo.io${person.email_status === 'verified' ? ' with verified email' : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in apollo-people-enrichment function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        found: false,
        source: 'apollo',
        confidence: 0,
        notes: `Error: ${error.message}`
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

