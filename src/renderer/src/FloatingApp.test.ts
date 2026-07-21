import { describe, expect, it } from 'vitest'
import { getSpinDurationSeconds, smoothFloatingTraffic } from './FloatingApp'

describe('smoothFloatingTraffic', () => {
  it('shows the first sample without startup lag', () => {
    expect(smoothFloatingTraffic([{ upload: 120, download: 240 }])).toEqual({
      upload: 120,
      download: 240
    })
  })

  it('gives the newest of three samples the highest weight', () => {
    expect(
      smoothFloatingTraffic([
        { upload: 0, download: 700 },
        { upload: 700, download: 0 },
        { upload: 1400, download: 1400 }
      ])
    ).toEqual({ upload: 1000, download: 900 })
  })

  it('returns each direction to zero immediately', () => {
    expect(
      smoothFloatingTraffic([
        { upload: 900, download: 900 },
        { upload: 600, download: 600 },
        { upload: 0, download: 300 }
      ])
    ).toEqual({ upload: 0, download: 471 })
  })
})

describe('getSpinDurationSeconds', () => {
  it('keeps a visible idle rotation when traffic is zero', () => {
    expect(getSpinDurationSeconds(0)).toBe(10)
  })

  it('rotates faster as traffic increases', () => {
    expect(getSpinDurationSeconds(409600)).toBe(1)
    expect(getSpinDurationSeconds(819200)).toBe(0.5)
  })

  it('clamps rotation to the supported duration range', () => {
    expect(getSpinDurationSeconds(1)).toBe(10)
    expect(getSpinDurationSeconds(Number.MAX_SAFE_INTEGER)).toBe(0.1)
  })
})
