import type {
  Campaign,
  CampaignInput,
  CampaignList,
  CampaignStats,
  Meta,
  Offer,
  Stream,
  StreamOffer,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ValidationIssue {
  loc?: (string | number)[]
  msg?: string
}

function errorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return (detail as ValidationIssue[])
      .map((issue) => {
        const field = issue.loc?.filter((part) => part !== 'body').join('.')
        const msg = (issue.msg ?? 'Invalid value').replace(/^Value error, /, '')
        return field ? `${field}: ${msg}` : msg
      })
      .join('; ')
  }
  if (status >= 500) return 'Server error. Please try again later.'
  return `Request failed (HTTP ${status})`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Network error: the server is unreachable', 0)
  }
  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(errorMessage(body, response.status), response.status)
  return body as T
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  body: JSON.stringify(data),
})

export const api = {
  meta: () => request<Meta>('/meta'),
  offers: () => request<Offer[]>('/offers'),

  campaigns: (params: { q?: string; limit: number; offset: number }) => {
    const search = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    })
    if (params.q) search.set('q', params.q)
    return request<CampaignList>(`/campaigns?${search.toString()}`)
  },
  campaign: (id: number) => request<Campaign>(`/campaigns/${id}`),
  createCampaign: (data: CampaignInput) => request<Campaign>('/campaigns', json('POST', data)),
  updateCampaign: (id: number, data: Partial<CampaignInput>) =>
    request<Campaign>(`/campaigns/${id}`, json('PATCH', data)),
  deleteCampaign: (id: number) => request<void>(`/campaigns/${id}`, { method: 'DELETE' }),

  streams: (campaignId: number) => request<Stream[]>(`/campaigns/${campaignId}/streams`),
  syncStreams: (campaignId: number) =>
    request<Stream[]>(`/campaigns/${campaignId}/streams/sync`, { method: 'POST' }),
  pushOffers: (campaignId: number, streamId: number, offers: StreamOffer[]) =>
    request<Stream>(
      `/campaigns/${campaignId}/streams/${streamId}/offers`,
      json('PUT', {
        offers: offers.map(({ offer_id, share, pinned, is_active }) => ({
          offer_id,
          share,
          pinned,
          is_active,
        })),
      }),
    ),
  stats: (campaignId: number, days = 7) =>
    request<CampaignStats>(`/campaigns/${campaignId}/stats?days=${days}`),
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}
