import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./ipc-core', () => ({
  C: { checkMihomoLatestVersion: 'checkMihomoLatestVersion' },
  invokeSafe: vi.fn()
}))

describe('checkMihomoLatestVersion', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const { invokeSafe } = await import('./ipc-core')
    const { checkMihomoLatestVersion } = await import('./mihomo-ipc')
    return { invoke: vi.mocked(invokeSafe), check: checkMihomoLatestVersion }
  }

  it('shares pending requests and caches success for three minutes', async () => {
    const { invoke, check } = await setup()
    let resolve!: (value: string) => void
    invoke.mockReturnValueOnce(new Promise<string>((done) => (resolve = done)))
    const first = check(false)
    const second = check(false)
    expect(invoke).toHaveBeenCalledTimes(1)
    resolve('v1.19.33')
    expect(await Promise.all([first, second])).toEqual(['v1.19.33', 'v1.19.33'])
    await vi.advanceTimersByTimeAsync(179_999)
    expect(await check(false)).toBe('v1.19.33')
    expect(invoke).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    invoke.mockResolvedValueOnce('v1.19.34')
    expect(await check(false)).toBe('v1.19.34')
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('does not cache backend failures returned as null', async () => {
    const { invoke, check } = await setup()
    invoke.mockResolvedValueOnce(null).mockResolvedValueOnce('v1.19.33')
    expect(await check(false)).toBeNull()
    expect(await check(false)).toBe('v1.19.33')
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('clears rejected requests so recovery can check again', async () => {
    const { invoke, check } = await setup()
    invoke.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('v1.19.33')
    await expect(check(false)).rejects.toThrow('offline')
    expect(await check(false)).toBe('v1.19.33')
  })

  it('isolates stable and alpha requests and caches', async () => {
    const { invoke, check } = await setup()
    invoke.mockResolvedValueOnce('v1.19.33').mockResolvedValueOnce('abc123')
    expect(await Promise.all([check(false), check(true)])).toEqual(['v1.19.33', 'abc123'])
    expect(await check(false)).toBe('v1.19.33')
    expect(await check(true)).toBe('abc123')
    expect(invoke).toHaveBeenCalledTimes(2)
  })
})
