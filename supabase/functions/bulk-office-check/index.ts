import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const COMPANIES_HOUSE_API = "https://api.company-information.service.gov.uk"
const API_KEY = Deno.env.get("COMPANIES_HOUSE_API_KEY")

const BATCH_SIZE = 10
const DELAY_MS = 500
const RATE_MAX = 600
const RATE_WINDOW_MS = 5 * 60 * 1000

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const rateLog: number[] = []

function canRequest(): boolean {
  const now = Date.now()
  while (rateLog.length && now - rateLog[0] > RATE_WINDOW_MS) rateLog.shift()
  return rateLog.length < RATE_MAX
}

function recordRequest(): void {
  rateLog.push(Date.now())
}

function zeroPad(num: string): string {
  const n = num.replace(/\D/g, "").trim()
  return n ? n.padStart(8, "0") : ""
}

function formatAddress(addr: Record<string, unknown> | null): string {
  if (!addr || typeof addr !== "object") return ""
  const keys = ["premises", "address_line_1", "address_line_2", "locality", "region", "postal_code", "country"]
  return keys
    .map((k) => (addr[k] != null ? String(addr[k]).trim() : ""))
    .filter(Boolean)
    .join(", ")
}

function extractPostcode(addr: string | Record<string, unknown>): string {
  if (typeof addr === "object" && addr !== null) {
    const pc = (addr as Record<string, string>).postal_code || (addr as Record<string, string>).postcode
    return pc ? String(pc).replace(/\s+/g, "").toUpperCase() : ""
  }
  const match = String(addr).match(/\b([A-Za-z]{1,2}\d{1,2}[A-Za-z]?\s*\d[A-Za-z]{2})\b/)
  return match ? match[1].replace(/\s+/g, "").toUpperCase() : ""
}

function normalizeAddress(s: string): string {
  if (!s) return ""
  let t = String(s).toUpperCase().trim().replace(/\s+/g, " ")
  t = t.replace(/\b(LIMITED|LTD|PLC|LLP)\b/g, "").replace(/\b(ENGLAND|UNITED KINGDOM|UK)\b/g, "")
  t = t.replace(/[^\w\s,.-]/g, " ").replace(/\s+/g, " ").trim()
  return t
}

const DISSOLVED = new Set(["dissolved", "liquidation", "receivership", "administration", "converted-closed"])

interface CompanyRow {
  company_number: string
  company_name: string
  company_status: string
  registered_office: string
  address_line_1: string
  locality: string
  postal_code: string
  date_of_creation: string
  sic_codes: string
  error: string
}

async function fetchCompany(companyNumber: string): Promise<CompanyRow> {
  if (!API_KEY) {
    return {
      company_number: companyNumber,
      company_name: "",
      company_status: "",
      registered_office: "",
      address_line_1: "",
      locality: "",
      postal_code: "",
      date_of_creation: "",
      sic_codes: "",
      error: "Companies House API key not configured",
    }
  }
  if (!canRequest()) {
    return {
      company_number: companyNumber,
      company_name: "",
      company_status: "",
      registered_office: "",
      address_line_1: "",
      locality: "",
      postal_code: "",
      date_of_creation: "",
      sic_codes: "",
      error: "Rate limit",
    }
  }
  recordRequest()
  const auth = btoa(`${API_KEY}:`)
  const res = await fetch(`${COMPANIES_HOUSE_API}/company/${companyNumber}`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  })
  if (!res.ok) {
    return {
      company_number: companyNumber,
      company_name: "",
      company_status: "",
      registered_office: "",
      address_line_1: "",
      locality: "",
      postal_code: "",
      date_of_creation: "",
      sic_codes: "",
      error: res.status === 404 ? "Not found" : `HTTP ${res.status}`,
    }
  }
  const data = await res.json()
  const addr = data.registered_office_address || {}
  const sic = data.sic_codes || []
  return {
    company_number: companyNumber,
    company_name: (data.company_name || "").trim(),
    company_status: (data.company_status || "").trim(),
    registered_office: formatAddress(addr),
    address_line_1: (addr.address_line_1 || addr.premises || "").toString(),
    locality: (addr.locality || "").toString(),
    postal_code: (addr.postal_code || "").toString(),
    date_of_creation: (data.date_of_creation || "").toString(),
    sic_codes: Array.isArray(sic) ? sic.join(", ") : String(sic),
    error: "",
  }
}

function compareAddresses(
  results: CompanyRow[],
  knownAddress: string
): { still_there: CompanyRow[]; moved: CompanyRow[]; dissolved: CompanyRow[]; errors: CompanyRow[] } {
  const knownNorm = normalizeAddress(knownAddress)
  let knownPostcode = extractPostcode(knownAddress)
  if (!knownPostcode && knownNorm) {
    const m = knownNorm.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/)
    if (m) knownPostcode = m[1].replace(/\s+/g, "")
  }

  const still_there: CompanyRow[] = []
  const moved: CompanyRow[] = []
  const dissolved: CompanyRow[] = []
  const errors: CompanyRow[] = []

  for (const r of results) {
    if (r.error) {
      errors.push(r)
      continue
    }
    const status = r.company_status.toLowerCase()
    if (DISSOLVED.has(status)) {
      dissolved.push(r)
      continue
    }
    const currentOffice = r.registered_office || ""
    const currentPostcode = (r.postal_code || extractPostcode(currentOffice)).replace(/\s+/g, "").toUpperCase()
    const currentNorm = normalizeAddress(currentOffice)

    if (knownPostcode && currentPostcode) {
      if (knownPostcode === currentPostcode) still_there.push(r)
      else moved.push(r)
      continue
    }
    if (knownNorm && currentNorm) {
      if (knownNorm.includes(currentNorm) || currentNorm.includes(knownNorm)) still_there.push(r)
      else moved.push(r)
      continue
    }
    moved.push(r)
  }

  return { still_there, moved, dissolved, errors }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("bulk-office-check: request received", req.method)
  try {
    const body = await req.json()
    const companyCount = Array.isArray(body.company_numbers) ? body.company_numbers.length : 0
    console.log("bulk-office-check: body parsed", companyCount, "companies")
    const company_numbers: string[] = Array.isArray(body.company_numbers) ? body.company_numbers : []
    const known_address: string = typeof body.known_address === "string" ? body.known_address.trim() : ""

    if (!known_address || company_numbers.length === 0) {
      return new Response(
        JSON.stringify({ error: "company_numbers and known_address are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const unique = [...new Set(company_numbers.map(zeroPad).filter(Boolean))]
    const results: CompanyRow[] = []

    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(batch.map(fetchCompany))
      results.push(...batchResults)
      if (i + BATCH_SIZE < unique.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS))
      }
    }

    const { still_there, moved, dissolved, errors } = compareAddresses(results, known_address)

    const payload = {
      total_checked: results.length,
      still_there,
      moved,
      dissolved,
      errors,
      summary: {
        still_there: still_there.length,
        moved: moved.length,
        dissolved: dissolved.length,
        errors: errors.length,
      },
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
