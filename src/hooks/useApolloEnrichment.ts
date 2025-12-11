import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apollo } from '../services/apollo'
import type { CompanyForEnrichment } from '../types/enrichment'
import type { ApolloEnrichmentResult } from '../types/apollo'

/**
 * Hook for enriching a single company with Apollo.io
 */
export function useApolloEnrichment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ company, includeContacts = true }: { company: CompanyForEnrichment; includeContacts?: boolean }) =>
      apollo.enrichCompany(company, includeContacts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apollo-enrichment'] })
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

/**
 * Hook for confirming an address with Apollo.io
 */
export function useApolloConfirmAddress() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({
      company,
      address,
    }: {
      company: CompanyForEnrichment
      address: { line1: string; postcode: string }
    }) => apollo.confirmAddress(company, address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apollo-enrichment'] })
    },
  })
}

/**
 * Hook for bulk enrichment
 */
export function useBulkApolloEnrichment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({
      companies,
      includeContacts = false,
      onProgress,
    }: {
      companies: CompanyForEnrichment[]
      includeContacts?: boolean
      onProgress?: (current: number, total: number) => void
    }) => apollo.enrichBatch(companies, includeContacts, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apollo-enrichment'] })
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

/**
 * Hook to get cached enrichment result for a company
 */
export function useCompanyEnrichment(companyName: string | undefined, companyNumber: string | undefined) {
  return useQuery({
    queryKey: ['apollo-enrichment', companyNumber, companyName],
    queryFn: async (): Promise<ApolloEnrichmentResult | null> => {
      if (!companyName || !companyNumber) return null
      
      // Check cache first (24-hour TTL)
      const cacheKey = `apollo-enrichment-${companyNumber}`
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        const age = Date.now() - parsed.timestamp
        if (age < 24 * 60 * 60 * 1000) { // 24 hours
          return parsed.result
        }
      }
      
      return null
    },
    enabled: !!companyName && !!companyNumber,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  })
}

