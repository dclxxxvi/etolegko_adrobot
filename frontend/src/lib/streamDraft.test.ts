import { describe, expect, it } from 'vitest'
import { draftReducer, initDraft, isDirty, offerChange, type DraftState } from './streamDraft'
import type { StreamOffer } from './types'

const offer = (id: number, share: number, extra: Partial<StreamOffer> = {}): StreamOffer => ({
  offer_id: id,
  offer_name: `Offer ${id}`,
  share,
  pinned: false,
  is_active: true,
  ...extra,
})

const view = (state: DraftState) =>
  state.offers.map((o) => [o.offer_id, o.share, o.pinned, o.is_active] as const)

describe('draftReducer', () => {
  const base = [offer(1, 100)]

  it('adds an offer and redistributes shares', () => {
    const state = draftReducer(initDraft(base), { type: 'add', offerId: 2, name: 'Two' })
    expect(view(state)).toEqual([
      [1, 50, false, true],
      [2, 50, false, true],
    ])
    expect(isDirty(state)).toBe(true)
    expect(offerChange(state.offers[1], state.base)).toBe('added')
  })

  it('keeps a pinned share when a new offer is added', () => {
    let state = draftReducer(initDraft(base), { type: 'add', offerId: 2, name: null })
    state = draftReducer(state, { type: 'setShare', offerId: 1, share: 80 })
    state = draftReducer(state, { type: 'add', offerId: 3, name: null })
    expect(view(state)).toEqual([
      [1, 80, true, true],
      [2, 10, false, true],
      [3, 10, false, true],
    ])
  })

  it('removes an offer: it stays in the list with 0%', () => {
    const start = initDraft([offer(1, 50), offer(2, 50)])
    const state = draftReducer(start, { type: 'remove', offerId: 1 })
    expect(view(state)).toEqual([
      [1, 0, false, false],
      [2, 100, false, true],
    ])
    expect(offerChange(state.offers[0], state.base)).toBe('removed')
  })

  it('brings back a removed offer (also via add)', () => {
    const start = initDraft([offer(1, 0, { is_active: false }), offer(2, 100)])
    const viaBringBack = draftReducer(start, { type: 'bringBack', offerId: 1 })
    const viaAdd = draftReducer(start, { type: 'add', offerId: 1, name: null })
    expect(view(viaBringBack)).toEqual([
      [1, 50, false, true],
      [2, 50, false, true],
    ])
    expect(viaAdd).toEqual(viaBringBack)
    expect(offerChange(viaBringBack.offers[0], start.base)).toBe('restored')
  })

  it('pin/unpin toggles only active offers', () => {
    const start = initDraft([offer(1, 0, { is_active: false }), offer(2, 100)])
    expect(draftReducer(start, { type: 'togglePin', offerId: 1 }).offers[0].pinned).toBe(false)
    const pinned = draftReducer(start, { type: 'togglePin', offerId: 2 })
    expect(pinned.offers[1].pinned).toBe(true)
    expect(draftReducer(pinned, { type: 'togglePin', offerId: 2 }).offers[1].pinned).toBe(false)
  })

  it('cancel restores the saved state', () => {
    const start = initDraft(base)
    const edited = draftReducer(start, { type: 'add', offerId: 2, name: null })
    const cancelled = draftReducer(edited, { type: 'cancel' })
    expect(cancelled.offers).toEqual(base)
    expect(isDirty(cancelled)).toBe(false)
  })

  it('remove + bring back without other changes is not dirty', () => {
    let state = initDraft([offer(1, 50), offer(2, 50)])
    state = draftReducer(state, { type: 'remove', offerId: 2 })
    state = draftReducer(state, { type: 'bringBack', offerId: 2 })
    expect(isDirty(state)).toBe(false)
  })

  it('reset replaces the saved state', () => {
    const edited = draftReducer(initDraft(base), { type: 'add', offerId: 2, name: null })
    const next = [offer(1, 60), offer(2, 40)]
    const state = draftReducer(edited, { type: 'reset', base: next })
    expect(state).toEqual({ base: next, offers: next })
  })
})
