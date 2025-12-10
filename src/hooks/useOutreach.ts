import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outreachGeneration, type OutreachRequest } from '../services/outreach-generation'

export function useOutreachDrafts(practiceId: string | undefined, prospectId?: string) {
  return useQuery({
    queryKey: ['outreach-drafts', practiceId, prospectId],
    queryFn: () => outreachGeneration.getOutreachDrafts(practiceId!, prospectId),
    enabled: !!practiceId,
  })
}

export function useGenerateOutreach() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: OutreachRequest) => outreachGeneration.generateOutreach(request),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['outreach-drafts', variables.practiceId],
      })
    },
  })
}

export function useSaveOutreachDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draft: Parameters<typeof outreachGeneration.saveDraft>[0]) =>
      outreachGeneration.saveDraft(draft),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['outreach-drafts', variables.practiceId],
      })
    },
  })
}

export function useMarkDraftSent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draftId: string) => outreachGeneration.markDraftSent(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-drafts'] })
    },
  })
}

