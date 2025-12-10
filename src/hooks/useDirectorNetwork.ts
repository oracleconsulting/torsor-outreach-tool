import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { directors } from '../services/directors'

export function useCompanyDirectors(companyNumber: string | undefined) {
  return useQuery({
    queryKey: ['directors', 'company', companyNumber],
    queryFn: () => directors.getCompanyDirectors(companyNumber!),
    enabled: !!companyNumber,
  })
}

export function useDirectorNetwork(companyNumber: string | undefined) {
  return useQuery({
    queryKey: ['director-network', companyNumber],
    queryFn: async () => {
      // This would need practiceId - for now return empty
      // Will be implemented when we have practice context
      return []
    },
    enabled: false, // Disabled until we have practice context
  })
}

export function useNetworkOpportunities(practiceId: string | undefined) {
  return useQuery({
    queryKey: ['network-opportunities', practiceId],
    queryFn: () => directors.getNetworkOpportunities(practiceId!),
    enabled: !!practiceId,
  })
}

export function useBuildNetwork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      practiceId,
      companyNumber,
    }: {
      practiceId: string
      companyNumber: string
    }) => directors.buildNetworkForCompany(practiceId, companyNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network-opportunities'] })
      queryClient.invalidateQueries({ queryKey: ['director-network'] })
    },
  })
}

