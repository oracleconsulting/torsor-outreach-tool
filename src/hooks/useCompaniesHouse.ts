import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesHouse } from '../services/companiesHouse'
import type { Company, Officer, Filing, FirmDiscoveryParams, SearchOptions } from '../types'

export function useCompany(companyNumber: string | undefined) {
  return useQuery({
    queryKey: ['company', companyNumber],
    queryFn: () => companiesHouse.getCompany(companyNumber!),
    enabled: !!companyNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCompanyOfficers(companyNumber: string | undefined, activeOnly = false) {
  return useQuery({
    queryKey: ['officers', companyNumber, activeOnly],
    queryFn: () => companiesHouse.getOfficers(companyNumber!, activeOnly),
    enabled: !!companyNumber,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCompanyFilings(companyNumber: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['filings', companyNumber, limit],
    queryFn: () => companiesHouse.getFilingHistory(companyNumber!, limit),
    enabled: !!companyNumber,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCompanySearch(query: string, options?: SearchOptions) {
  return useQuery({
    queryKey: ['company-search', query, options],
    queryFn: () => companiesHouse.searchCompanies(query, options),
    enabled: query.length >= 2,
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  })
}

export function useFirmDiscovery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: FirmDiscoveryParams) => companiesHouse.discoverFirmClients(params),
    onSuccess: () => {
      // Invalidate prospects list in case new ones were discovered
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

export function useBatchCompanyFetch() {
  return useMutation({
    mutationFn: async (companyNumbers: string[]) => {
      const results = await Promise.allSettled(
        companyNumbers.map((num) => companiesHouse.getCompany(num))
      )
      return results.map((result, index) => ({
        companyNumber: companyNumbers[index],
        company: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
      }))
    },
  })
}

