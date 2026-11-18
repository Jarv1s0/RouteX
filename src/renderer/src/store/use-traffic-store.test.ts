import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTrafficStore } from './use-traffic-store'

const mocks = vi.hoisted(() => ({
  traffic: null as ((sample: ControllerTraffic) => void) | null,
  connections: null as ((snapshot: ControllerConnections) => void) | null,
  stats: vi.fn()
}))
vi.mock('@renderer/utils/stats-ipc', () => ({ getTrafficStats: mocks.stats }))
vi.mock('@renderer/utils/mihomo-ipc', () => ({
  subscribeDesktopTraffic: (handler: typeof mocks.traffic) => {
    mocks.traffic = handler
    return vi.fn()
  }
}))
vi.mock('./use-connections-store', () => ({
  subscribeConnectionSnapshot: (handler: typeof mocks.connections) => {
    mocks.connections = handler
    return vi.fn()
  }
}))
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

it('does not mutate published rule details when a later snapshot adds a connection', async () => {
  const firstConnection = {
    id: 'first',
    rule: 'MATCH',
    rulePayload: 'example.com',
    upload: 1,
    download: 2,
    start: '2026-11-18T00:00:00.000Z',
    isActive: true,
    chains: [],
    metadata: {}
  } as unknown as ControllerConnectionDetail

  mocks.connections!({ connections: [firstConnection] } as ControllerConnections)
  const previousState = useTrafficStore.getState()
  const previousDetails = previousState.ruleHitDetails
  const previousRuleDetails = previousDetails.get('MATCH,example.com')!
  const previousRuleStats = previousState.ruleStats.get('MATCH,example.com')!
  expect(previousRuleDetails.map(({ id }) => id)).toEqual(['first'])

  await vi.advanceTimersByTimeAsync(1001)
  const secondConnection = { ...firstConnection, id: 'second', upload: 10 }
  mocks.connections!({ connections: [firstConnection, secondConnection] } as ControllerConnections)

  const currentDetails = useTrafficStore.getState().ruleHitDetails
  expect(previousDetails.get('MATCH,example.com')?.map(({ id }) => id)).toEqual(['first'])
  expect(currentDetails.get('MATCH,example.com')?.map(({ id }) => id)).toEqual(['second', 'first'])
  expect(previousRuleStats).toEqual({ hits: 1, upload: 1, download: 2 })
  expect(useTrafficStore.getState().ruleStats.get('MATCH,example.com')).toEqual({
    hits: 2,
    upload: 10,
    download: 2
  })
})
