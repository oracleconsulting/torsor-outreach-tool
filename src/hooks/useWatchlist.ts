import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { events } from '../services/events'

export function useWatchlist(practiceId: string | undefined) {
  return useQuery({
    queryKey: ['watchlist', practiceId],
    queryFn: () => events.getWatchlist(practiceId!),
    enabled: !!practiceId,
  })
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      practiceId,
      companyNumber,
      eventTypes,
    }: {
      practiceId: string
      companyNumber: string
      eventTypes?: string[]
    }) => events.addToWatchlist(practiceId, companyNumber, eventTypes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ practiceId, companyNumber }: { practiceId: string; companyNumber: string }) =>
      events.removeFromWatchlist(practiceId, companyNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })
}

export function usePendingEvents(practiceId: string | undefined) {
  return useQuery({
    queryKey: ['pending-events', practiceId],
    queryFn: () => events.getPendingEvents(practiceId!),
    enabled: !!practiceId,
    refetchInterval: 60000, // Refetch every minute
  })
}

export function useEventsByType(practiceId: string | undefined, eventType: string) {
  return useQuery({
    queryKey: ['events-by-type', practiceId, eventType],
    queryFn: () => events.getEventsByType(practiceId!, eventType),
    enabled: !!practiceId && !!eventType,
  })
}

export function useDetectEvents() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (practiceId: string) => events.detectEvents(practiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-events'] })
      queryClient.invalidateQueries({ queryKey: ['events-by-type'] })
    },
  })
}

