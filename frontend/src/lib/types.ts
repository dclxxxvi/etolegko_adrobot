export interface Campaign {
  id: number
  name: string
  country_code: string
  offer_id: number
  offer_name: string | null
  kt_campaign_id: number
  kt_alias: string
  created_at: string
  updated_at: string
}

export interface CampaignList {
  items: Campaign[]
  total: number
}

export interface CampaignInput {
  name: string
  country_code: string
  offer_id: number
}

export interface StreamOffer {
  offer_id: number
  offer_name: string | null
  share: number
  pinned: boolean
  is_active: boolean
}

export interface Stream {
  id: number
  kt_stream_id: number
  name: string
  position: number
  schema_type: string
  action_payload: string | null
  countries: string[]
  offers: StreamOffer[]
}

export interface Offer {
  id: number
  name: string
}

export interface Metrics {
  clicks: number
  conversions: number
  revenue: number
  daily_clicks: number[]
}

export interface StreamStats {
  total: Metrics
  offers: Record<string, Metrics>
}

export interface CampaignStats {
  days: string[]
  streams: Record<string, StreamStats>
}

export interface Meta {
  keitaro_url: string
}
