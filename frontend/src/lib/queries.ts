import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Campaign, CampaignInput, Stream, StreamOffer } from './types'

export const PAGE_SIZE = 20

export const queryKeys = {
  campaigns: ['campaigns'] as const,
  campaignList: (q: string, page: number) => ['campaigns', 'list', { q, page }] as const,
  campaign: (id: number) => ['campaigns', 'detail', id] as const,
  streams: (id: number) => ['campaigns', 'detail', id, 'streams'] as const,
  stats: (id: number) => ['campaigns', 'detail', id, 'stats'] as const,
  offers: ['offers'] as const,
  meta: ['meta'] as const,
}

export function useMeta() {
  return useQuery({ queryKey: queryKeys.meta, queryFn: api.meta, staleTime: Infinity })
}

export function useOffers(enabled = true) {
  return useQuery({ queryKey: queryKeys.offers, queryFn: api.offers, staleTime: 60_000, enabled })
}

export function useCampaigns(q: string, page: number) {
  return useQuery({
    queryKey: queryKeys.campaignList(q, page),
    queryFn: () => api.campaigns({ q, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
}

export function useCampaign(id: number) {
  return useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: () => api.campaign(id),
    enabled: Number.isFinite(id),
  })
}

export function useStreams(id: number) {
  return useQuery({
    queryKey: queryKeys.streams(id),
    queryFn: () => api.streams(id),
    enabled: Number.isFinite(id),
  })
}

export function useStats(id: number) {
  return useQuery({
    queryKey: queryKeys.stats(id),
    queryFn: () => api.stats(id),
    enabled: Number.isFinite(id),
    staleTime: 60_000,
    retry: 1,
  })
}

export function useSaveCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: CampaignInput }) =>
      id === undefined ? api.createCampaign(data) : api.updateCampaign(id, data),
    onSuccess: (campaign: Campaign) => {
      client.setQueryData(queryKeys.campaign(campaign.id), campaign)
      void client.invalidateQueries({ queryKey: queryKeys.campaigns })
    },
  })
}

export function useDeleteCampaign() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteCampaign(id),
    onSuccess: (_, id) => {
      client.removeQueries({ queryKey: queryKeys.campaign(id) })
      void client.invalidateQueries({ queryKey: queryKeys.campaigns })
    },
  })
}

export function useSyncStreams(campaignId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.syncStreams(campaignId),
    onSuccess: (streams) => {
      client.setQueryData(queryKeys.streams(campaignId), streams)
      void client.invalidateQueries({ queryKey: queryKeys.stats(campaignId) })
    },
  })
}

export function usePushOffers(campaignId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ streamId, offers }: { streamId: number; offers: StreamOffer[] }) =>
      api.pushOffers(campaignId, streamId, offers),
    onSuccess: (stream) => {
      client.setQueryData<Stream[]>(queryKeys.streams(campaignId), (streams) =>
        streams?.map((s) => (s.id === stream.id ? stream : s)),
      )
      void client.invalidateQueries({ queryKey: queryKeys.campaign(campaignId) })
    },
  })
}
