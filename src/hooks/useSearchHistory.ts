import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { searchHistory } from '../services/searchHistory'

export function useSearchHistory(practiceId: string | undefined) {
  return useQuery({
    queryKey: ['search-history', practiceId],
    queryFn: () => searchHistory.getSearchHistory(practiceId!),
    enabled: !!practiceId,
  })
}

export function useSaveSearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      practiceId,
      userId,
      searchType,
      searchParams,
      resultsCount,
    }: {
      practiceId: string
      userId: string
      searchType: 'address' | 'firm' | 'postcode' | 'company'
      searchParams: Record<string, any>
      resultsCount: number
    }) =>
      searchHistory.saveSearch(practiceId, userId, searchType, searchParams, resultsCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-history'] })
    },
  })
}

export function useDeleteSearch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => searchHistory.deleteSearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search-history'] })
    },
  })
}

