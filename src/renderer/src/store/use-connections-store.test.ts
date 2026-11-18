import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useConnectionsStore } from './use-connections-store'

const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  releases: [] as ReturnType<typeof vi.fn>[],
  worker: { onmessage: null as ((event: { data: unknown }) => void) | null, postMessage: vi.fn() }
}))

vi.mock('@renderer/utils/ipc-channels', () => ({ ON: {}, onIpc: () => vi.fn() }))
vi.mock('@renderer/utils/mihomo-ipc', () => ({
  mihomoConnections: mocks.snapshot,
  isExpectedMihomoUnavailableError: () => true,
  retainTauriConnectionsBridge: () => {
    const release = vi.fn()
    mocks.releases.push(release)
    return release
  },
  retainTauriMemoryBridge: () => vi.fn(),
  onTauriBridgeConnectionsReady: () => vi.fn(),
  mihomoCloseAllConnections: vi.fn(),
  mihomoCloseConnection: vi.fn()
}))
vi.mock('@renderer/workers/connections-worker?worker', () => ({
  default: class {
    constructor() {
      return mocks.worker
    }
  }
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setTimeout, clearTimeout }))
  vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  mocks.snapshot.mockImplementation(() => new Promise(() => {}))
  mocks.releases.length = 0
  mocks.worker.postMessage.mockClear()
})

afterEach(() => {
  useConnectionsStore.getState().cleanupListeners()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('releases each listener session once across repeated navigation', () => {
  const cleanup = useConnectionsStore.getState().cleanupListeners
  for (let i = 0; i < 20; i++) {
    useConnectionsStore.getState().initializeListeners()
    cleanup({ clearSnapshot: false })
  }
  expect(useConnectionsStore.getState().cleanupListeners).toBe(cleanup)
  expect(mocks.releases).toHaveLength(20)
  mocks.releases.forEach((release) => expect(release).toHaveBeenCalledTimes(1))
  expect(vi.getTimerCount()).toBe(0)
})

it('ignores failed snapshots after cleanup instead of scheduling retries', async () => {
  let reject!: (error: Error) => void
  mocks.snapshot.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail
      })
  )
  useConnectionsStore.getState().initializeListeners()
  useConnectionsStore.getState().cleanupListeners()
  reject(new Error('core unavailable'))
  await Promise.resolve()
  await Promise.resolve()
  expect(vi.getTimerCount()).toBe(0)
  expect(useConnectionsStore.getState().loading).toBe(true)
})

it('ignores worker results from a previous session and accepts the current result', async () => {
  mocks.snapshot.mockResolvedValue({ connections: [], uploadTotal: 0, downloadTotal: 0 })
  useConnectionsStore.getState().initializeListeners()
  await Promise.resolve()
  const old = mocks.worker.postMessage.mock.calls.find(
    ([message]) => message.type === 'process'
  )![0]
  useConnectionsStore.getState().initializeListeners()
  await Promise.resolve()
  const current = mocks.worker.postMessage.mock.calls
    .filter(([message]) => message.type === 'process')
    .at(-1)![0]
  const result = (generation: number, connectionCount: number) => ({
    data: {
      type: 'process_result',
      generation,
      payload: { activeConnections: [], closedConnections: [], connectionCount }
    }
  })
  mocks.worker.onmessage!(result(old.generation, 99))
  expect(useConnectionsStore.getState().connectionCount).toBe(0)
  mocks.worker.onmessage!(result(current.generation, 1))
  expect(useConnectionsStore.getState().connectionCount).toBe(1)
})
