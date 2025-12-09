import { supabase } from '../lib/supabase'
import type { Company, Officer, Filing, SearchResult, FirmDiscoveryResult, FirmDiscoveryParams, SearchOptions, ApiError } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// Cache for company data (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000
const cache = new Map<string, { data: any; timestamp: number }>()

function getCacheKey(type: string, identifier: string): string {
  return `ch_cache_${type}_${identifier}`
}

function getCached<T>(key: string): T | null {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

async function callEdgeFunction(functionName: string, body: any): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const companiesHouse = {
  async getCompany(companyNumber: string): Promise<Company> {
    const cacheKey = getCacheKey('company', companyNumber)
    const cached = getCached<Company>(cacheKey)
    if (cached) return cached

    try {
      const data = await callEdgeFunction('companies-house', {
        action: 'getCompany',
        params: { companyNumber },
      })

      // Transform to our Company type
      const company: Company = {
        company_number: data.company_number,
        company_name: data.company_name,
        company_status: data.company_status,
        company_type: data.company_type,
        incorporation_date: data.date_of_creation,
        dissolution_date: data.date_of_dissolution,
        sic_codes: data.sic_codes || [],
        registered_office_address: data.registered_office_address,
        accounts: data.accounts,
        has_charges: data.has_charges,
        has_insolvency_history: data.has_insolvency_history,
      }

      setCache(cacheKey, company)
      return company
    } catch (error: any) {
      if (error.message.includes('404')) {
        throw new Error(`Company ${companyNumber} not found`)
      }
      throw error
    }
  },

  async getOfficers(companyNumber: string, activeOnly = false): Promise<Officer[]> {
    const cacheKey = getCacheKey('officers', `${companyNumber}_${activeOnly}`)
    const cached = getCached<Officer[]>(cacheKey)
    if (cached) return cached

    const data = await callEdgeFunction('companies-house', {
      action: 'getOfficers',
      params: { companyNumber },
    })

    let officers: Officer[] = (data.items || []).map((item: any) => ({
      name: item.name,
      officer_role: item.officer_role,
      appointed_on: item.appointed_on,
      resigned_on: item.resigned_on,
      occupation: item.occupation,
      nationality: item.nationality,
    }))

    if (activeOnly) {
      officers = officers.filter((o) => !o.resigned_on)
    }

    setCache(cacheKey, officers)
    return officers
  },

  async getFilingHistory(companyNumber: string, limit = 25): Promise<Filing[]> {
    const cacheKey = getCacheKey('filings', `${companyNumber}_${limit}`)
    const cached = getCached<Filing[]>(cacheKey)
    if (cached) return cached

    const data = await callEdgeFunction('companies-house', {
      action: 'getFilingHistory',
      params: { companyNumber, limit },
    })

    const filings: Filing[] = (data.items || []).map((item: any) => ({
      transaction_id: item.transaction_id,
      filing_date: item.date,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
    }))

    setCache(cacheKey, filings)
    return filings
  },

  async searchCompanies(query: string, options?: SearchOptions): Promise<{ items: Company[]; total_results: number }> {
    const data = await callEdgeFunction('companies-house', {
      action: 'searchCompanies',
      params: { query, ...options },
    })

    const companies: Company[] = (data.items || []).map((item: any) => ({
      company_number: item.company_number,
      company_name: item.title,
      company_status: item.company_status,
      company_type: item.company_type,
      incorporation_date: item.date_of_creation,
      sic_codes: item.sic_codes || [],
      registered_office_address: item.address,
    }))

    return {
      items: companies,
      total_results: data.total_results || 0,
    }
  },

  async searchByPostcode(postcode: string): Promise<Company[]> {
    const data = await callEdgeFunction('companies-house', {
      action: 'searchByPostcode',
      params: { postcode },
    })

    return (data.items || []).map((item: any) => ({
      company_number: item.company_number,
      company_name: item.title,
      company_status: item.company_status,
      sic_codes: item.sic_codes || [],
      registered_office_address: item.address,
    }))
  },

  async discoverFirmClients(params: FirmDiscoveryParams): Promise<FirmDiscoveryResult> {
    const data = await callEdgeFunction('address-discovery', {
      action: 'discoverFirmClients',
      params,
      practiceId: params.practiceId,
    })

    return data
  },
}

