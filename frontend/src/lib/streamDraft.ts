import { clampShare, redistribute } from './shares'
import type { StreamOffer } from './types'

export interface DraftState {
  /** Last state saved in Keitaro */
  base: StreamOffer[]
  /** Current (possibly edited) state */
  offers: StreamOffer[]
}

export type DraftAction =
  | { type: 'reset'; base: StreamOffer[] }
  | { type: 'cancel' }
  | { type: 'add'; offerId: number; name: string | null }
  | { type: 'remove'; offerId: number }
  | { type: 'bringBack'; offerId: number }
  | { type: 'togglePin'; offerId: number }
  | { type: 'setShare'; offerId: number; share: number }

export type OfferChange = 'added' | 'restored' | 'removed' | 'changed' | null

export function initDraft(base: StreamOffer[]): DraftState {
  return { base, offers: base }
}

function update(
  offers: StreamOffer[],
  offerId: number,
  patch: (o: StreamOffer) => Partial<StreamOffer>,
): StreamOffer[] {
  return offers.map((o) => (o.offer_id === offerId ? { ...o, ...patch(o) } : o))
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  const set = (offers: StreamOffer[]) => ({ ...state, offers: redistribute(offers) })

  switch (action.type) {
    case 'reset':
      return initDraft(action.base)
    case 'cancel':
      return { ...state, offers: state.base }
    case 'add': {
      if (state.offers.some((o) => o.offer_id === action.offerId)) {
        return draftReducer(state, { type: 'bringBack', offerId: action.offerId })
      }
      return set([
        ...state.offers,
        {
          offer_id: action.offerId,
          offer_name: action.name,
          share: 0,
          pinned: false,
          is_active: true,
        },
      ])
    }
    case 'remove':
      return set(update(state.offers, action.offerId, () => ({ is_active: false, pinned: false })))
    case 'bringBack':
      return set(update(state.offers, action.offerId, () => ({ is_active: true, pinned: false })))
    case 'togglePin':
      return set(
        update(state.offers, action.offerId, (o) => ({ pinned: o.is_active && !o.pinned })),
      )
    case 'setShare':
      return set(
        update(state.offers, action.offerId, (o) =>
          o.is_active ? { share: clampShare(action.share), pinned: true } : {},
        ),
      )
  }
}

export function offerChange(offer: StreamOffer, base: StreamOffer[]): OfferChange {
  const saved = base.find((o) => o.offer_id === offer.offer_id)
  if (!saved) return 'added'
  if (!saved.is_active && offer.is_active) return 'restored'
  if (saved.is_active && !offer.is_active) return 'removed'
  if (saved.share !== offer.share || saved.pinned !== offer.pinned) return 'changed'
  return null
}

export function isDirty(state: DraftState): boolean {
  return (
    state.offers.length !== state.base.length ||
    state.offers.some((o) => offerChange(o, state.base) !== null)
  )
}
