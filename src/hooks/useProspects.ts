import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { prospects } from '../services/prospects'
import type { ProspectFilters, NewProspect, ProspectUpdate } from '../types'

export function useProspects(practiceId: string | undefined, filters?: ProspectFilters) {
  return useQuery({
    queryKey: ['prospects', practiceId, filters],
    queryFn: () => prospects.getProspects(practiceId!, filters),
    enabled: !!practiceId,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  })
}

export function useProspect(id: string | undefined) {
  return useQuery({
    queryKey: ['prospect', id],
    queryFn: () => prospects.getProspect(id!),
    enabled: !!id,
  })
}

export function useSaveProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (prospect: NewProspect) => prospects.saveProspect(prospect),
    onSuccess: (data) => {
      // Invalidate prospects list
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      // Set the new prospect in cache
      queryClient.setQueryData(['prospect', data.id], data)
    },
  })
}

export function useUpdateProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProspectUpdate }) =>
      prospects.updateProspect(id, updates),
    onSuccess: (data) => {
      // Update single prospect cache
      queryClient.setQueryData(['prospect', data.id], data)
      // Invalidate prospects list
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

export function useDeleteProspect() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => prospects.deleteProspect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

export function useBulkSaveProspects() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (prospectsList: NewProspect[]) => prospects.bulkSaveProspects(prospectsList),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
    },
  })
}

export function useProspectStats(practiceId: string | undefined) {
  return useQuery({
    queryKey: ['prospect-stats', practiceId],
    queryFn: async () => {
      const allProspects = await prospects.getProspects(practiceId!)
      
      const stats = {
        total: allProspects.length,
        byStatus: {} as Record<string, number>,
        averageScore: 0,
        conversionRate: 0,
      }

      let totalScore = 0
      let converted = 0

      allProspects.forEach((p) => {
        stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1
        totalScore += p.prospect_score
        if (p.status === 'converted') converted++
      })

      stats.averageScore = allProspects.length > 0 ? totalScore / allProspects.length : 0
      stats.conversionRate = allProspects.length > 0 ? (converted / allProspects.length) * 100 : 0

      return stats
    },
    enabled: !!practiceId,
  })
}

