import { describe, expect, it } from 'vitest'
import { calcPercent, calcTraffic } from './calc'

describe('calcTraffic', () => {
  it('formats bytes without scaling', () => {
    expect(calcTraffic(42)).toBe('42.00 B')
  })

  it('scales traffic units at binary thresholds', () => {
    expect(calcTraffic(1024)).toBe('1.00 KB')
    expect(calcTraffic(1024 * 1024)).toBe('1.00 MB')
    expect(calcTraffic(1536 * 1024)).toBe('1.50 MB')
  })
})

describe('calcPercent', () => {
  it('returns 100 when required values are missing', () => {
    expect(calcPercent(undefined, 1, 2)).toBe(100)
    expect(calcPercent(1, undefined, 2)).toBe(100)
    expect(calcPercent(1, 2, undefined)).toBe(100)
  })

  it('rounds upload and download usage over total', () => {
    expect(calcPercent(20, 31, 100)).toBe(51)
  })
})
