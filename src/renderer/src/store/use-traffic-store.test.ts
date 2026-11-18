import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTrafficStore } from './use-traffic-store'

const mocks = vi.hoisted(() => ({
  traffic: null as ((sample: ControllerTraffic) => void) | null,
  stats: vi.fn()
}))
vi.mock('@renderer/utils/stats-ipc', () => ({ getTrafficStats: mocks.stats }))
vi.mock('@renderer/utils/mihomo-ipc', () => ({
  subscribeDesktopTraffic: (handler: typeof mocks.traffic) => {
    mocks.traffic = handler
    return vi.fn()
  }
}))
vi.mock('./use-connections-store', () => ({ subscribeConnectionSnapshot: () => vi.fn() }))
vi.mock('@renderer/utils/tauri-traffic-stats', () => ({
  getRecentTauriTrafficPoints: () => [],
  resetTauriTrafficRecorder: vi.fn()
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { setInterval, clearInterval })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  mocks.stats.mockImplementation(() => new Promise(() => {}))
  useTrafficStore.getState().clearStats()
  useTrafficStore.getState().initializeListeners()
})

afterEach(() => {
  useTrafficStore.getState().cleanupListeners()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('uses backend byte totals instead of adding rate samples, including coalesced frames', async () => {
  mocks.traffic!({
    up: 2000,
    down: 4000,
    sessionUpload: 1000,
    sessionDownload: 2000,
    timestamp: 100
  })
  mocks.traffic!({
    up: 2000,
    down: 4000,
    sessionUpload: 2000,
    sessionDownload: 4000,
    timestamp: 600
  })
  await vi.advanceTimersByTimeAsync(16)
  expect(useTrafficStore.getState().sessionStats).toEqual({ upload: 2000, download: 4000 })
  expect(useTrafficStore.getState().trafficHistory).toHaveLength(1)
  mocks.traffic!({ up: 0, down: 0, sessionUpload: 2000, sessionDownload: 4000, timestamp: 1100 })
  await vi.advanceTimersByTimeAsync(16)
  expect(useTrafficStore.getState().sessionStats).toEqual({ upload: 2000, download: 4000 })
})

it('does not let an older historical fetch overwrite a newer realtime total', async () => {
  let resolve!: (value: unknown) => void
  mocks.stats.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const fetching = useTrafficStore.getState().fetchInitialStats()
  mocks.traffic!({
    up: 2000,
    down: 4000,
    sessionUpload: 5000,
    sessionDownload: 10000,
    timestamp: 200
  })
  await vi.advanceTimersByTimeAsync(16)
  resolve({ hourly: [], daily: [], sessionUpload: 1000, sessionDownload: 2000, lastUpdate: 100 })
  await fetching
  expect(useTrafficStore.getState().sessionStats).toEqual({ upload: 5000, download: 10000 })
})

it('ignores a historical response issued before stats were cleared', async () => {
  let resolve!: (value: unknown) => void
  mocks.stats.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const fetching = useTrafficStore.getState().fetchInitialStats()
  useTrafficStore.getState().clearStats()
  resolve({
    hourly: [{ hour: 'old', upload: 123, download: 456 }],
    daily: [],
    sessionUpload: 123,
    sessionDownload: 456,
    lastUpdate: 100
  })
  await fetching
  expect(useTrafficStore.getState().sessionStats).toEqual({ upload: 0, download: 0 })
  expect(useTrafficStore.getState().hourlyData).toEqual([])
})
