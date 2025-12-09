import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fitMatching } from '../services/fit-matching'
import type { Company } from '../types'

export function usePracticeCapabilities(practiceId: string | undefined) {
  return useQuery({
    queryKey: ['practice-capabilities', practiceId],
    queryFn: () => fitMatching.getPracticeCapabilities(practiceId!),
    enabled: !!practiceId,
  })
}

export function useFitScore(practiceId: string | undefined, companyNumber: string | undefined) {
  return useQuery({
    queryKey: ['fit-score', practiceId, companyNumber],
    queryFn: () => fitMatching.getFitScore(practiceId!, companyNumber!),
    enabled: !!practiceId && !!companyNumber,
  })
}

export function useCalculateFit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      practiceId,
      companyNumber,
      company,
    }: {
      practiceId: string
      companyNumber: string
      company: Company
    }) => fitMatching.calculatePracticeFit(practiceId, companyNumber, company),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['fit-score', variables.practiceId, variables.companyNumber],
      })
    },
  })
}

export function useSyncCapabilities() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (practiceId: string) => fitMatching.syncPracticeCapabilities(practiceId),
    onSuccess: (_, practiceId) => {
      queryClient.invalidateQueries({ queryKey: ['practice-capabilities', practiceId] })
    },
  })
}

