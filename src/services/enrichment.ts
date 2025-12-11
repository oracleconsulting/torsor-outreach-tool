import { supabase } from '../lib/supabase'
import type {
  EnrichmentRequest,
  EnrichmentResult,
  FindEnrichmentResult,
  ConfirmEnrichmentResult,
  CompanyForEnrichment,
} from '../types/enrichment'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callEnrichmentFunction(request: EnrichmentRequest): Promise<EnrichmentResult> {
  const { data: { session } } = await supabase.auth.getSession()

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/address-enrichment`, {
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
      throw new Error(`Network error: Unable to reach address enrichment service. Please check your connection and ensure the Edge Function is deployed.`)
    }
    throw error
  }
}

export const enrichment = {
  async findAddress(company: CompanyForEnrichment): Promise<FindEnrichmentResult> {
    const request: EnrichmentRequest = {
      operation: 'find',
      companyName: company.company_name,
      companyNumber: company.company_number,
      registeredAddress: company.registered_address
        ? formatAddress(company.registered_address)
        : undefined,
      directorName: company.director_name,
      principalActivity: company.principal_activity,
      sicCode: company.sic_code,
    }

    const result = await callEnrichmentFunction(request)
    return result as FindEnrichmentResult
  },

  async confirmAddress(
    company: CompanyForEnrichment,
    address: { line1: string; line2?: string; town: string; postcode: string }
  ): Promise<ConfirmEnrichmentResult> {
    const request: EnrichmentRequest = {
      operation: 'confirm',
      companyName: company.company_name,
      companyNumber: company.company_number,
      addressToConfirm: address,
      directorName: company.director_name,
      principalActivity: company.principal_activity,
    }

    const result = await callEnrichmentFunction(request)
    return result as ConfirmEnrichmentResult
  },

  async bulkEnrich(
    companies: CompanyForEnrichment[],
    operation: 'find' | 'confirm',
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<string, EnrichmentResult>> {
    const results = new Map<string, EnrichmentResult>()

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]
      onProgress?.(i + 1, companies.length)

      try {
        let result: EnrichmentResult

        if (operation === 'find') {
          result = await this.findAddress(company)
        } else {
          // For confirm, we need an address to confirm
          // This would come from the prospect's existing address
          // For now, skip if no address available
          if (!company.trading_address) {
            results.set(company.company_number, {
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
              notes: 'No address provided to confirm',
            })
            continue
          }

          const addr = company.trading_address
          result = await this.confirmAddress(company, {
            line1: addr.address_line_1 || addr.line1 || '',
            line2: addr.address_line_2 || addr.line2,
            town: addr.locality || addr.town || '',
            postcode: addr.postal_code || addr.postcode || '',
          })
        }

        results.set(company.company_number, result)
      } catch (error: any) {
        results.set(company.company_number, {
          success: false,
          operation,
          ...(operation === 'find'
            ? {
                addresses: [],
                confidence: 0,
                notes: error.message,
                sources: [],
              }
            : {
                confirmationResult: 'unknown',
                confirmationDetails: {
                  foundOnWebsite: false,
                  foundOnGoogleMaps: false,
                  isVirtualOffice: false,
                  isOutdated: false,
                  sources: [],
                },
                confidence: 0,
                notes: error.message,
              }),
        } as EnrichmentResult)
      }

      // Rate limiting - wait between requests
      if (i < companies.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return results
  },

  async saveEnrichmentRecord(
    practiceId: string,
    companyNumber: string,
    result: EnrichmentResult
  ): Promise<void> {
    const record: any = {
      practice_id: practiceId,
      company_number: companyNumber,
      operation: result.operation,
      confidence: result.confidence,
      notes: result.notes,
    }

    if (result.operation === 'find') {
      const findResult = result as FindEnrichmentResult
      record.found_addresses = findResult.addresses || []
      record.best_address = findResult.bestAddress
    } else {
      const confirmResult = result as ConfirmEnrichmentResult
      record.confirmation_result = confirmResult.confirmationResult
      record.confirmation_details = confirmResult.confirmationDetails
    }

    const { error } = await supabase.from('outreach.enrichment_records').insert(record)

    if (error) throw error
  },
}

function formatAddress(address: any): string {
  if (typeof address === 'string') return address

  const parts = [
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
  ].filter(Boolean)

  return parts.join(', ')
}

