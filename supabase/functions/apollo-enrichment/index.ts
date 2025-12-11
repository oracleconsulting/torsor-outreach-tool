import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY")!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface EnrichmentRequest {
  operation: 'find' | 'confirm'
  companyName: string
  companyNumber?: string
  domain?: string
  directorName?: string
  addressToConfirm?: {
    line1: string
    postcode: string
  }
  includeContacts?: boolean
}

function calculateConfidence(org: any, contacts: any[]): number {
  let confidence = 40
  if (org.street_address) confidence += 20
  if (org.postal_code) confidence += 15
  if (org.website_url) confidence += 10
  if (org.phone) confidence += 5
  if (contacts.some((c: any) => c.emailVerified)) confidence += 10
  return Math.min(100, confidence)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const request: EnrichmentRequest = await req.json()

    if (!request.companyName) {
      return new Response(
        JSON.stringify({ error: 'companyName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Apollo enrich endpoint requires domain, so we'll use search if no domain provided
    // First, try to extract domain from company name or use search endpoint
    let domain = request.domain
    
    // If no domain provided, try to extract from company name (basic heuristic)
    if (!domain && request.companyName) {
      // Try to find common UK domain patterns in company name
      const domainMatch = request.companyName.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})/i)
      if (domainMatch) {
        domain = domainMatch[1]
      }
    }
    
    // Use search endpoint if no domain, enrich if domain available
    let orgResponse
    if (domain) {
      // Use enrich endpoint with domain
      orgResponse = await fetch("https://api.apollo.io/api/v1/organizations/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": APOLLO_API_KEY
        },
        body: JSON.stringify({
          domain: domain
        })
      })
    } else {
      // Use search endpoint with name
      orgResponse = await fetch("https://api.apollo.io/api/v1/organizations/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": APOLLO_API_KEY
        },
        body: JSON.stringify({
          name: request.companyName,
          per_page: 1
        })
      })
    }

    if (!orgResponse.ok) {
      const errorText = await orgResponse.text()
      throw new Error(`Apollo API error: ${orgResponse.status} ${orgResponse.statusText} - ${errorText}`)
    }

    const orgData = await orgResponse.json()

    if (!orgData.organization) {
      return new Response(
        JSON.stringify({
          success: false,
          found: false,
          source: 'apollo',
          operation: request.operation,
          confidence: 0,
          notes: 'Organization not found in Apollo database'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const org = orgData.organization

    // For CONFIRM operation, check if Apollo address matches
    if (request.operation === 'confirm' && request.addressToConfirm) {
      const apolloPostcode = org.postal_code?.replace(/\s/g, '').toUpperCase() || ''
      const confirmPostcode = request.addressToConfirm.postcode?.replace(/\s/g, '').toUpperCase() || ''
      
      const confirmed = apolloPostcode === confirmPostcode && apolloPostcode.length > 0
      
      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          source: 'apollo',
          operation: 'confirm',
          confirmed,
          apolloAddress: {
            line1: org.street_address || '',
            city: org.city || '',
            postcode: org.postal_code || '',
            country: org.country || 'United Kingdom'
          },
          confidence: confirmed ? 95 : 40,
          notes: confirmed 
            ? 'Address confirmed via Apollo database' 
            : 'Address postcode does not match Apollo database'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // FIND operation: Get contacts if requested
    let contacts: any[] = []
    if (request.includeContacts !== false && org.id) {
      try {
        const peopleResponse = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY
          },
          body: JSON.stringify({
            organization_ids: [org.id],
            person_seniorities: ["owner", "founder", "c_suite", "partner", "director"],
            per_page: 5
          })
        })

        if (peopleResponse.ok) {
          const peopleData = await peopleResponse.json()
          contacts = (peopleData.people || []).map((p: any) => ({
            name: p.name || '',
            title: p.title || '',
            email: p.email || null,
            emailVerified: p.email_status === 'verified',
            phone: p.phone_numbers?.[0]?.sanitized_number || null,
            linkedIn: p.linkedin_url || null
          }))
        }
      } catch (error) {
        console.error('Error fetching contacts from Apollo:', error)
        // Continue without contacts if this fails
      }
    }

    const confidence = calculateConfidence(org, contacts)

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        source: 'apollo',
        operation: 'find',
        address: {
          line1: org.street_address || '',
          line2: org.street_address_2 || '',
          city: org.city || '',
          county: org.state || '',
          postcode: org.postal_code || '',
          country: org.country || 'United Kingdom'
        },
        company: {
          apolloId: org.id,
          website: org.website_url || null,
          phone: org.phone || null,
          industry: org.industry || null,
          employeeCount: org.estimated_num_employees || null,
          linkedIn: org.linkedin_url || null
        },
        contacts,
        confidence,
        notes: `Found via Apollo.io${contacts.length > 0 ? ` with ${contacts.length} contacts` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in apollo-enrichment function:', error)
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

