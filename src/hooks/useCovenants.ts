import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { covenants } from '../services/covenants'
import type { NewCovenant, CovenantUpdate } from '../types'

export function useCovenants(practiceId: string | undefined, includeExpired = false) {
  return useQuery({
    queryKey: ['covenants', practiceId, includeExpired],
    queryFn: () => covenants.getCovenants(practiceId!, includeExpired),
    enabled: !!practiceId,
  })
}

export function useCovenant(id: string | undefined) {
  return useQuery({
    queryKey: ['covenant', id],
    queryFn: () => covenants.getCovenant(id!),
    enabled: !!id,
  })
}

export function useCreateCovenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (covenant: NewCovenant) => covenants.createCovenant(covenant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['covenants'] })
    },
  })
}

export function useUpdateCovenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CovenantUpdate }) =>
      covenants.updateCovenant(id, updates),
    onSuccess: (data) => {
      queryClient.setQueryData(['covenant', data.id], data)
      queryClient.invalidateQueries({ queryKey: ['covenants'] })
    },
  })
}

export function useDeactivateCovenant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => covenants.deactivateCovenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['covenants'] })
    },
  })
}

export function useCovenantCheck(
  addressHash: string | undefined,
  practiceId: string | undefined,
  targetDate?: Date
) {
  return useQuery({
    queryKey: ['covenant-check', addressHash, practiceId, targetDate?.toISOString()],
    queryFn: () => covenants.checkCovenantSafety(addressHash!, practiceId!, targetDate),
    enabled: !!addressHash && !!practiceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

