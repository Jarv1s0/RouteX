import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MihomoSocketManager } from './mihomo-socket-manager'

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  invoke: vi.fn(),
  emit: vi.fn()
}))
vi.mock('./ipc-core', () => ({
  C: { getAppConfig: 'getAppConfig' },
  invokeSafe: mocks.invoke,
  invokeTyped: mocks.invoke
}))
vi.mock('@renderer/api/desktop', () => ({
  desktop: {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      mocks.listeners.set(channel, listener)
      return vi.fn()
    }
  },
  emitDesktopEvent: mocks.emit
}))

class Socket {
  static instances: Socket[] = []
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  close = vi.fn(() => {
    this.readyState = 3
  })
  constructor(public url: string) {
    Socket.instances.push(this)
  }
}

let manager: MihomoSocketManager
let controlledConfig: Partial<MihomoConfig>
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  vi.stubGlobal('document', { hidden: false })
  vi.stubGlobal('WebSocket', Socket)
  mocks.listeners.clear()
  mocks.invoke.mockResolvedValue({ connectionInterval: 500 })
  mocks.emit.mockClear()
  Socket.instances = []
  controlledConfig = { 'log-level': 'info' }
  manager = new MihomoSocketManager({
    getRuntimeConfig: async () => ({}) as MihomoConfig,
    readTauriControledMihomoConfig: () => controlledConfig,
    invalidateRuntimeConfigCache: vi.fn()
  })
  vi.spyOn(manager as unknown as { isTauriHost: () => boolean }, 'isTauriHost').mockReturnValue(
    true
  )
  manager.writeTauriControllerUrl('http://127.0.0.1:9090')
  manager.installTauriBridgeLifecycle()
  manager.startTauriMihomoEventBridge()
})

afterEach(() => {
  manager.stopTauriMihomoEventBridge()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('keeps sockets across appearance updates and reconnects only changed intervals', async () => {
  const release = manager.retainTauriConnectionsBridge()
  manager.retainTauriLogsBridge()
  await vi.waitFor(() => expect(Socket.instances).toHaveLength(2))
  expect(Socket.instances.map((socket) => socket.url)).toEqual([
    'ws://127.0.0.1:9090/logs?level=info',
    'ws://127.0.0.1:9090/connections?interval=500'
  ])
  const [logs, connections] = Socket.instances
  mocks.listeners.get('appConfigUpdated')!()
  await vi.advanceTimersByTimeAsync(0)
  expect(Socket.instances).toHaveLength(2)
  expect(connections.close).not.toHaveBeenCalled()
  mocks.invoke.mockResolvedValue({ connectionInterval: 1000 })
  mocks.listeners.get('appConfigUpdated')!()
  await vi.waitFor(() => expect(Socket.instances).toHaveLength(3))
  expect(connections.close).toHaveBeenCalledOnce()
  expect(logs.close).not.toHaveBeenCalled()
  expect(Socket.instances.at(-1)?.url).toContain('interval=1000')
  release()
  expect(Socket.instances.at(-1)?.close).toHaveBeenCalledOnce()
})

it('preserves healthy sockets when another socket disconnects', async () => {
  manager.retainTauriMemoryBridge()
  manager.retainTauriConnectionsBridge()
  await vi.waitFor(() => expect(Socket.instances).toHaveLength(2))
  const memory = Socket.instances.find((socket) => socket.url.endsWith('/memory'))!
  const connections = Socket.instances.find((socket) => socket.url.includes('/connections'))!
  connections.onerror!()
  await vi.advanceTimersByTimeAsync(1200)
  expect(memory.close).not.toHaveBeenCalled()
  expect(Socket.instances.filter((socket) => socket.url.endsWith('/memory'))).toHaveLength(1)
  expect(Socket.instances.filter((socket) => socket.url.includes('/connections'))).toHaveLength(2)
  memory.onmessage!({ data: '{"inuse":42}' })
  expect(mocks.emit).toHaveBeenCalledWith('mihomoMemory', { inuse: 42 })
})

it('discards a pending connections request after its last consumer releases', async () => {
  let resolve!: (value: { connectionInterval: number }) => void
  mocks.invoke.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const release = manager.retainTauriConnectionsBridge()
  release()
  resolve({ connectionInterval: 500 })
  await vi.advanceTimersByTimeAsync(0)
  expect(Socket.instances).toHaveLength(0)
})

it('resubscribes logs after the config cache catches up with the update event', () => {
  manager.retainTauriMemoryBridge()
  const release = manager.retainTauriLogsBridge()
  const memory = Socket.instances.find((socket) => socket.url.endsWith('/memory'))!
  const oldLogs = Socket.instances.find((socket) => socket.url.includes('/logs'))!
  const oldOnMessage = oldLogs.onmessage!

  // The backend event can arrive before the asynchronous config read completes.
  mocks.listeners.get('controledMihomoConfigUpdated')!()
  expect(oldLogs.close).not.toHaveBeenCalled()
  controlledConfig = { 'log-level': 'error' }
  manager.refreshTauriLogsSocket()

  expect(oldLogs.close).toHaveBeenCalledOnce()
  const logs = Socket.instances.at(-1)!
  expect(logs.url).toBe('ws://127.0.0.1:9090/logs?level=error')
  expect(memory.close).not.toHaveBeenCalled()
  oldOnMessage({ data: '{"type":"info","payload":"stale"}' })
  expect(mocks.emit).not.toHaveBeenCalled()
  logs.onmessage!({ data: '{"type":"error","payload":"failure"}' })
  expect(mocks.emit).toHaveBeenCalledWith('mihomoLogs', { type: 'error', payload: 'failure' })

  manager.refreshTauriLogsSocket()
  expect(Socket.instances).toHaveLength(3)
  release()
  manager.refreshTauriLogsSocket()
  expect(Socket.instances).toHaveLength(3)
})
