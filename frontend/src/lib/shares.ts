import type { StreamOffer } from './types'

/**
 * Redistributes traffic between active offers of a stream:
 * - removed offers get 0% and lose their pin;
 * - pinned offers keep their share;
 * - the rest (100 - pinned) is split evenly between unpinned active offers,
 *   the remainder goes 1% at a time to the first offers (34/33/33).
 */
export function redistribute(offers: StreamOffer[]): StreamOffer[] {
  const result = offers.map((o) => (o.is_active ? { ...o } : { ...o, share: 0, pinned: false }))
  const free = result.filter((o) => o.is_active && !o.pinned)
  if (free.length === 0) return result

  const pinnedSum = result
    .filter((o) => o.is_active && o.pinned)
    .reduce((sum, o) => sum + o.share, 0)
  const rest = Math.max(0, 100 - pinnedSum)
  const base = Math.floor(rest / free.length)
  const remainder = rest - base * free.length
  free.forEach((o, i) => {
    o.share = base + (i < remainder ? 1 : 0)
  })
  return result
}

export interface ShareValidation {
  error: string | null
  warning: string | null
  total: number
}

export function validateShares(offers: StreamOffer[]): ShareValidation {
  const active = offers.filter((o) => o.is_active)
  const total = active.reduce((sum, o) => sum + o.share, 0)
  const pinnedSum = active.filter((o) => o.pinned).reduce((sum, o) => sum + o.share, 0)

  if (active.length === 0) {
    return { error: null, warning: 'No active offers — stream traffic will not be routed', total }
  }
  if (pinnedSum > 100) {
    return { error: `Pinned shares exceed 100% (${pinnedSum}%)`, warning: null, total }
  }
  if (total !== 100) {
    return { error: `Shares must sum to 100% (now ${total}%)`, warning: null, total }
  }
  return { error: null, warning: null, total }
}

export function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}
