import { describe, expect, it } from 'vitest'
import { hasMihomoUpdate } from './mihomo-version'

describe('hasMihomoUpdate', () => {
  it.each([
    ['v1.19.9', 'v1.19.10', true],
    ['1.9.0', '1.10.0', true],
    ['v1.19.32', 'v1.19.33', true],
    ['v1.19.32', '1.19.32', false],
    ['1.20.0', '1.19.99', false],
    ['2.0.0', '1.99.99', false],
    ['1.99.99', '2.0.0', true],
    ['unknown', 'v1.19.33', false],
    [undefined, 'v1.19.33', false],
    ['v1.19.32', null, false]
  ])('compares %s with %s numerically', (current, latest, expected) => {
    expect(hasMihomoUpdate(current, latest, 'mihomo')).toBe(expected)
  })

  it('keeps alpha commit comparisons separate', () => {
    expect(hasMihomoUpdate('Mihomo Meta alpha-abc123', 'abc123', 'mihomo-alpha')).toBe(false)
    expect(hasMihomoUpdate('Mihomo Meta alpha-abc123', 'def456', 'mihomo-alpha')).toBe(true)
  })
})
