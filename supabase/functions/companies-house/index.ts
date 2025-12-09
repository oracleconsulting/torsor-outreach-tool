import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk"
const API_KEY = Deno.env.get("COMPANIES_HOUSE_API_KEY")!

// Rate limit: 600 requests per 5 minutes
const rateLimiter = {
  requests: [] as number[],
  maxRequests: 600,
  windowMs: 5 * 60 * 1000,
  
  canMakeRequest(): boolean {
    const now = Date.now()
    this.requests = this.requests.filter(t => now - t < this.windowMs)
    return this.requests.length < this.maxRequests
  },
  
  recordRequest(): void {
    this.requests.push(Date.now())
  },
  
  getWaitTime(): number {
    if (this.requests.length === 0) return 0
    const oldestInWindow = Math.min(...this.requests)
    return Math.max(0, this.windowMs - (Date.now() - oldestInWindow))
  }
}

async function companiesHouseRequest(endpoint: string): Promise<Response> {
  if (!rateLimiter.canMakeRequest()) {
    return new Response(
      JSON.stringify({ 
        error: "Rate limit exceeded", 
        retry_after_ms: rateLimiter.getWaitTime() 
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    )
  }
  
  rateLimiter.recordRequest()
  
  const auth = btoa(`${API_KEY}:`)
  const response = await fetch(`${COMPANIES_HOUSE_API}${endpoint}`, {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json"
    }
  })
  
  return response
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
    const { action, params } = await req.json()
    
    let endpoint: string
    let result: any
    
    switch (action) {
      case "getCompany":
        endpoint = `/company/${params.companyNumber}`
        break
        
      case "getOfficers":
        endpoint = `/company/${params.companyNumber}/officers`
        break
        
      case "getFilingHistory":
        endpoint = `/company/${params.companyNumber}/filing-history?items_per_page=${params.limit || 25}`
        break
        
      case "searchCompanies":
        const searchParams = new URLSearchParams({
          q: params.query,
          items_per_page: String(params.limit || 20),
          ...(params.start_index && { start_index: String(params.start_index) })
        })
        endpoint = `/search/companies?${searchParams}`
        break
        
      case "advancedSearch":
        const advParams = new URLSearchParams()
        if (params.company_name) advParams.set("company_name_includes", params.company_name)
        if (params.location) advParams.set("location", params.location)
        if (params.sic_codes) advParams.set("sic_codes", params.sic_codes.join(","))
        if (params.company_status) advParams.set("company_status", params.company_status)
        advParams.set("size", String(params.limit || 100))
        endpoint = `/advanced-search/companies?${advParams}`
        break
        
      case "searchByPostcode":
        // Search for companies with this postcode
        endpoint = `/advanced-search/companies?location=${encodeURIComponent(params.postcode)}&size=100`
        break
        
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
    
    const response = await companiesHouseRequest(endpoint)
    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

