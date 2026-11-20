import { describe, expect, it } from 'vitest'
import { offerDisplayName } from './offers'

describe('offerDisplayName', () => {
  it.each([
    ['18813 Flexacil [JOINT-PE] ReactJs v4', 'Flexacil [JOINT-PE] ReactJs v4'],
    ['#18813 - Flexacil', 'Flexacil'],
    ['18813: Flexacil', 'Flexacil'],
    ['18813 — Flexacil', 'Flexacil'],
    ['Flexacil 18813', 'Flexacil 18813'],
    ['188130 Other offer', '188130 Other offer'],
    ['18813', '18813'],
  ])('%s -> %s', (name, expected) => {
    expect(offerDisplayName(18813, name)).toBe(expected)
  })

  it('falls back for a missing name', () => {
    expect(offerDisplayName(1, null)).toBe('Unknown offer')
  })
})
