import { useMutation } from '@tanstack/react-query'
import { enrichment } from '../services/enrichment'
import type {
  CompanyForEnrichment,
  EnrichmentOperation,
  FindEnrichmentResult,
  ConfirmEnrichmentResult,
} from '../types/enrichment'

export function useEnrichment() {
  return useMutation<FindEnrichmentResult | ConfirmEnrichmentResult, Error, {
    company: CompanyForEnrichment
    operation: EnrichmentOperation
  }>({
    mutationFn: ({
      company,
      operation,
    }: {
      company: CompanyForEnrichment
      operation: EnrichmentOperation
    }) => {
      if (operation === 'find') {
        return enrichment.findAddress(company)
      } else {
        if (!company.trading_address) {
          throw new Error('No address provided to confirm')
        }
        const addr = company.trading_address
        return enrichment.confirmAddress(company, {
          line1: addr.address_line_1 || addr.line1 || '',
          line2: addr.address_line_2 || addr.line2,
          town: addr.locality || addr.town || '',
          postcode: addr.postal_code || addr.postcode || '',
        })
      }
    },
  })
}

export function useBulkEnrichment() {
  return useMutation({
    mutationFn: ({
      companies,
      operation,
      onProgress,
    }: {
      companies: CompanyForEnrichment[]
      operation: EnrichmentOperation
      onProgress?: (current: number, total: number) => void
    }) => enrichment.bulkEnrich(companies, operation, onProgress),
  })
}

