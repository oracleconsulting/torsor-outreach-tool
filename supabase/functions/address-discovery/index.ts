import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

// SIC codes for accounting firms
const ACCOUNTING_SIC_CODES = ['69201', '69202', '69203']

function normalizeAddress(address: any): string {
  const parts = []
  for (const field of ['premises', 'address_line_1', 'address_line_2', 'locality', 'postal_code']) {
    if (address[field]) {
      parts.push(String(address[field]).toUpperCase().trim())
    }
  }
  return parts.join(", ")
}

function generateAddressHash(address: any): string {
  const line1 = (address.address_line_1 || '').toLowerCase().trim()
  const postcode = (address.postal_code || '').toLowerCase().trim()
  // Simple hash - in production use proper hash function
  return btoa(line1 + postcode).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
}

function isAccountingFirm(sicCodes: string[]): boolean {
  return sicCodes?.some(code => ACCOUNTING_SIC_CODES.includes(code)) ?? false
}

function scoreProspect(company: any, targetSicCodes?: string[]): { score: number; factors: Record<string, number> } {
  let score = 5
  const factors: Record<string, number> = {}
  
  // Active status (+1)
  if (company.company_status === 'active') {
    score += 1
    factors.active_status = 1
  }
  
  // Company age
  if (company.date_of_creation) {
    const creationDate = new Date(company.date_of_creation)
    const ageYears = (Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    
    if (ageYears >= 5) {
      score += 2
      factors.company_age = 2
    } else if (ageYears >= 2) {
      score += 1
      factors.company_age = 1
    }
  }
  
  // Has filed accounts (+1)
  if (company.accounts?.last_accounts?.made_up_to) {
    score += 1
    factors.has_accounts = 1
  }
  
  // Industry match (+2)
  if (targetSicCodes && company.sic_codes?.some((c: string) => targetSicCodes.includes(c))) {
    score += 2
    factors.industry_match = 2
  }
  
  return { score: Math.min(score, 10), factors }
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
    const { action, params, practiceId } = await req.json()
    
    switch (action) {
      case "discoverFirmClients": {
        // 1. Get firm profile
        const firmResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/companies-house`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ action: "getCompany", params: { companyNumber: params.firmNumber } })
          }
        )
        const firm = await firmResponse.json()
        
        if (!firm.registered_office_address) {
          return new Response(
            JSON.stringify({ error: "Firm has no registered address" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
        
        const firmAddress = firm.registered_office_address
        const addressHash = generateAddressHash(firmAddress)
        
        // 2. Search for companies at this postcode
        const searchResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/companies-house`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ 
              action: "searchByPostcode", 
              params: { postcode: firmAddress.postal_code } 
            })
          }
        )
        const searchResults = await searchResponse.json()
        
        // 3. Filter to matching address and non-accounting firms
        const companies = []
        for (const item of searchResults.items || []) {
          // Skip if same company as the firm
          if (item.company_number === params.firmNumber) continue
          
          // Skip accounting firms
          if (isAccountingFirm(item.sic_codes || [])) continue
          
          // Check address similarity
          const itemAddress = item.registered_office_address || {}
          const itemHash = generateAddressHash(itemAddress)
          
          // Only include if at same address
          if (itemHash === addressHash || 
              (itemAddress.address_line_1?.toLowerCase() === firmAddress.address_line_1?.toLowerCase() &&
               itemAddress.postal_code?.toLowerCase() === firmAddress.postal_code?.toLowerCase())) {
            
            const { score, factors } = scoreProspect(item, params.targetSicCodes)
            
            // Check covenant restrictions
            let isCovenantSafe = true
            let covenantFirmName = null
            
            if (practiceId && params.covenantStartDate && params.covenantEndDate) {
              const { data: covenants } = await supabase
                .from('outreach.covenant_restrictions')
                .select('accounting_firm_name')
                .eq('practice_id', practiceId)
                .eq('address_hash', addressHash)
                .eq('is_active', true)
                .lte('restriction_start_date', params.covenantEndDate)
                .gte('restriction_end_date', params.covenantStartDate)
                .limit(1)
              
              if (covenants && covenants.length > 0) {
                isCovenantSafe = false
                covenantFirmName = covenants[0].accounting_firm_name
              }
            }
            
            companies.push({
              company_number: item.company_number,
              company_name: item.company_name,
              company_status: item.company_status,
              sic_codes: item.sic_codes || [],
              registered_address: normalizeAddress(itemAddress),
              prospect_score: score,
              score_factors: factors,
              is_covenant_safe: isCovenantSafe,
              covenant_firm_name: covenantFirmName
            })
          }
        }
        
        // Sort by score
        companies.sort((a, b) => b.prospect_score - a.prospect_score)
        
        return new Response(
          JSON.stringify({
            firm: {
              company_number: firm.company_number,
              company_name: firm.company_name,
              registered_address: normalizeAddress(firmAddress)
            },
            companies,
            total_found: companies.length,
            address_hash: addressHash
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

