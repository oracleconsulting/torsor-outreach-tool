import { supabase } from '../lib/supabase'
import type { ApolloEnrichmentRequest, ApolloEnrichmentResult } from '../types/apollo'
import type { CompanyForEnrichment } from '../types/enrichment'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callApolloFunction(request: ApolloEnrichmentRequest): Promise<ApolloEnrichmentResult> {
  const { data: { session } } = await supabase.auth.getSession()

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/apollo-enrichment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`
      try {
        const error = await response.json()
        errorMessage = error.error || error.message || errorMessage
      } catch {
        const errorText = await response.text()
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    return response.json()
  } catch (error: any) {
    // Handle network errors, CORS, etc.
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error(`Network error: Unable to reach Apollo enrichment service. Please check your connection and ensure the Edge Function is deployed.`)
    }
    throw error
  }
}

export const apollo = {
  /**
   * Enrich a single company with Apollo.io
   */
  async enrichCompany(company: CompanyForEnrichment, includeContacts: boolean = true): Promise<ApolloEnrichmentResult> {
    // Extract domain from website if available
    let domain: string | undefined
    if (company.registered_address) {
      // Try to extract domain from registered address or other sources
      // For now, we'll rely on company name matching
    }

    const request: ApolloEnrichmentRequest = {
      operation: 'find',
      companyName: company.company_name,
      companyNumber: company.company_number,
      domain,
      directorName: company.director_name,
      includeContacts,
    }

    return callApolloFunction(request)
  },

  /**
   * Confirm an address using Apollo.io
   */
  async confirmAddress(
    company: CompanyForEnrichment,
    address: { line1: string; postcode: string }
  ): Promise<ApolloEnrichmentResult> {
    const request: ApolloEnrichmentRequest = {
      operation: 'confirm',
      companyName: company.company_name,
      companyNumber: company.company_number,
      addressToConfirm: address,
      includeContacts: false,
    }

    return callApolloFunction(request)
  },

  /**
   * Bulk enrich multiple companies
   */
  async enrichBatch(
    companies: CompanyForEnrichment[],
    includeContacts: boolean = false, // Default to false for bulk to save credits
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, ApolloEnrichmentResult>> {
    const results = new Map<string, ApolloEnrichmentResult>()

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]
      onProgress?.(i + 1, companies.length)

      try {
        const result = await this.enrichCompany(company, includeContacts)
        results.set(company.company_number, result)
      } catch (error: any) {
        results.set(company.company_number, {
          success: false,
          found: false,
          source: 'apollo',
          operation: 'find',
          confidence: 0,
          notes: error.message,
        })
      }

      // Rate limiting - wait between requests (Apollo allows 120 requests/minute)
      if (i < companies.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600)) // 600ms = ~100 requests/minute
      }
    }

    return results
  },

  /**
   * Save enrichment result to database
   */
  async saveEnrichmentRecord(
    practiceId: string,
    companyNumber: string,
    result: ApolloEnrichmentResult
  ): Promise<void> {
    const record: any = {
      practice_id: practiceId,
      company_number: companyNumber,
      operation: result.operation,
      confidence: result.confidence,
      notes: result.notes,
      enrichment_source: 'apollo',
    }

    if (result.address) {
      record.found_addresses = [result.address]
      record.best_address = result.address
    }

    if (result.company) {
      record.apollo_org_id = result.company.apolloId
      record.company_website = result.company.website
      record.company_phone = result.company.phone
      record.company_industry = result.company.industry
      record.company_employee_count = result.company.employeeCount
    }

    if (result.operation === 'confirm') {
      record.confirmation_result = result.confirmed ? 'confirmed' : 'not_confirmed'
      record.confirmation_details = {
        confirmed: result.confirmed,
        apolloAddress: result.apolloAddress,
      }
    }

    const { error } = await supabase.from('outreach.enrichment_records').insert(record)

    if (error) throw error
  },
}

