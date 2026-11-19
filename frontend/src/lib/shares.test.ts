import { describe, expect, it } from 'vitest'
import { clampShare, redistribute, validateShares } from './shares'
import type { StreamOffer } from './types'

const offer = (id: number, share: number, extra: Partial<StreamOffer> = {}): StreamOffer => ({
  offer_id: id,
  offer_name: null,
  share,
  pinned: false,
  is_active: true,
  ...extra,
})

const shares = (offers: StreamOffer[]) => offers.map((o) => o.share)

describe('redistribute', () => {
  it('splits evenly and gives the remainder to the first offers', () => {
    expect(shares(redistribute([offer(1, 0), offer(2, 0), offer(3, 0)]))).toEqual([34, 33, 33])
    expect(shares(redistribute([offer(1, 100), offer(2, 0)]))).toEqual([50, 50])
  })

  it('keeps pinned shares and splits the rest', () => {
    const result = redistribute([offer(1, 70, { pinned: true }), offer(2, 0), offer(3, 0)])
    expect(shares(result)).toEqual([70, 15, 15])
  })

  it('zeroes and unpins removed offers', () => {
    const result = redistribute([offer(1, 50, { pinned: true, is_active: false }), offer(2, 50)])
    expect(result[0]).toMatchObject({ share: 0, pinned: false })
    expect(result[1].share).toBe(100)
  })

  it('leaves shares untouched when every active offer is pinned', () => {
    const result = redistribute([offer(1, 30, { pinned: true }), offer(2, 30, { pinned: true })])
    expect(shares(result)).toEqual([30, 30])
  })

  it('gives 0 to unpinned offers when pins take everything', () => {
    expect(shares(redistribute([offer(1, 100, { pinned: true }), offer(2, 40)]))).toEqual([100, 0])
  })

  it('does not mutate input', () => {
    const input = [offer(1, 10), offer(2, 10)]
    redistribute(input)
    expect(shares(input)).toEqual([10, 10])
  })
})

describe('validateShares', () => {
  it('accepts 100%', () => {
    expect(validateShares([offer(1, 60), offer(2, 40)]).error).toBeNull()
  })

  it('rejects sum other than 100%', () => {
    expect(validateShares([offer(1, 30, { pinned: true })]).error).toMatch(/sum to 100%/)
  })

  it('rejects pinned shares over 100%', () => {
    const result = validateShares([offer(1, 80, { pinned: true }), offer(2, 30, { pinned: true })])
    expect(result.error).toMatch(/exceed 100%/)
  })

  it('warns about a stream without active offers', () => {
    const result = validateShares([offer(1, 0, { is_active: false })])
    expect(result.error).toBeNull()
    expect(result.warning).toMatch(/No active offers/)
  })
})

describe('clampShare', () => {
  it.each([
    [-5, 0],
    [150, 100],
    [33.6, 34],
    [Number.NaN, 0],
  ])('%s -> %s', (input, expected) => {
    expect(clampShare(input)).toBe(expected)
  })
})
