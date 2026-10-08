import type { SWRConfiguration } from 'swr'
import { defaultConfig } from 'swr/_internal'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const captured = vi.hoisted(() => ({
  key: null as [string, boolean] | null,
  fetcher: null as ((key: [string, boolean]) => Promise<string>) | null,
  config: null as SWRConfiguration<string> | null
}))

vi.mock('swr', () => ({
  default: (
    key: [string, boolean],
    fetcher: (key: [string, boolean]) => Promise<string>,
    config: SWRConfiguration<string>
  ) => {
    Object.assign(captured, { key, fetcher, config })
    return { data: undefined }
  }
}))
vi.mock('@renderer/utils/mihomo-ipc', () => ({ checkMihomoLatestVersion: vi.fn() }))

import { checkMihomoLatestVersion } from '@renderer/utils/mihomo-ipc'
import { useMihomoLatestVersion } from './use-mihomo-latest-version'

describe('Mihomo latest version check policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('document', { hidden: false })
    vi.stubGlobal('navigator', { onLine: true })
    useMihomoLatestVersion('mihomo')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function scheduleRetry(retryCount: number) {
    const revalidate = vi.fn()
    const config = { ...defaultConfig, ...captured.config! }
    config.onErrorRetry!(new Error('network'), 'key', config, revalidate, {
      retryCount,
      dedupe: true
    })
    return revalidate
  }

  it('enables foreground polling and focus/reconnect checks despite provider defaults', () => {
    expect(captured.config).toMatchObject({
      refreshInterval: 300_000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: false
    })
    expect(captured.key).toEqual(['mihomoLatestVersion', false])
    useMihomoLatestVersion('mihomo-alpha')
    expect(captured.key).toEqual(['mihomoLatestVersion', true])
  })

  it('treats backend null as a retryable failure', async () => {
    vi.mocked(checkMihomoLatestVersion).mockResolvedValueOnce(null)
    await expect(captured.fetcher!(captured.key!)).rejects.toThrow('version check failed')
  })

  it.each([
    [1, 30_000],
    [2, 60_000],
    [3, 120_000],
    [4, 240_000],
    [5, 300_000],
    [20, 300_000]
  ])('backs off retry %i to %i ms', async (count, delay) => {
    const revalidate = scheduleRetry(count)
    await vi.advanceTimersByTimeAsync(delay - 1)
    expect(revalidate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(revalidate).toHaveBeenCalledExactlyOnceWith({ retryCount: count, dedupe: true })
  })

  it.each(['hidden', 'offline'])('skips requests and pending retries while %s', async (state) => {
    const revalidate = scheduleRetry(1)
    if (state === 'hidden') vi.stubGlobal('document', { hidden: true })
    else vi.stubGlobal('navigator', { onLine: false })
    await expect(captured.fetcher!(captured.key!)).rejects.toThrow('version check paused')
    expect(checkMihomoLatestVersion).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(revalidate).not.toHaveBeenCalled()
  })
})
