// @vitest-environment jsdom
import { useEffect, useLayoutEffect, useRef, type PropsWithChildren } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ReactFlowProps, useStoreApi } from '@xyflow/react'
import TopologyMap from './TopologyMap'

const state = vi.hoisted(() => ({
  store: undefined as ReturnType<typeof useStoreApi> | undefined,
  events: [] as string[],
  connections: [] as ControllerConnectionDetail[]
}))
vi.mock('@renderer/hooks/use-connections', () => ({
  useConnections: () => ({ connections: state.connections, loading: false })
}))
vi.mock('@renderer/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    onPress,
    isDisabled
  }: PropsWithChildren<{ onPress?: () => void; isDisabled?: boolean }>) => (
    <button disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
  Input: () => <input />,
  Spinner: () => <span />
}))
vi.mock('./connections/topology/CustomNodes', () => ({ nodeTypes: {} }))
vi.mock('./connections/topology/AnimatedEdge', () => ({ edgeTypes: {} }))
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  // Retain the real provider, store, node adoption, initialization and fitView queue.
  // Replace only DOM rendering/measurement, which jsdom cannot perform.
  function MeasuredFlow({
    children,
    nodes = [],
    onNodesChange,
    defaultViewport
  }: PropsWithChildren<ReactFlowProps>) {
    const store = actual.useStoreApi()
    const mounted = useRef(false)
    state.store = store
    useLayoutEffect(() => {
      if (mounted.current) return
      mounted.current = true
      store.setState({
        width: 800,
        height: 480,
        transform: defaultViewport
          ? [defaultViewport.x, defaultViewport.y, defaultViewport.zoom]
          : [0, 0, 1],
        panZoom: {
          setViewport: async (viewport: { x: number; y: number; zoom: number }) => {
            state.events.push('viewport-applied')
            store.setState({ transform: [viewport.x, viewport.y, viewport.zoom] })
            return viewport
          }
        } as unknown as NonNullable<ReturnType<typeof store.getState>['panZoom']>
      })
    }, [defaultViewport, store])
    useLayoutEffect(() => {
      store.setState({ onNodesChange })
      store.getState().setNodes(nodes)
      state.events.push(`nodes-initialized:${store.getState().nodesInitialized}`)
    }, [nodes, onNodesChange, store])
    useEffect(() => {
      const changes = nodes
        .filter((node) => !node.measured)
        .map((node) => ({
          id: node.id,
          type: 'dimensions' as const,
          dimensions: { width: node.width!, height: node.height! }
        }))
      if (changes.length) {
        state.events.push('dimensions-emitted')
        onNodesChange?.(changes)
      }
    }, [nodes, onNodesChange])
    return <div>{children}</div>
  }
  return { ...actual, ReactFlow: MeasuredFlow, Controls: () => null }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-19T00:00:00Z'))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0)
  )
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(480)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  state.store = undefined
  state.events = []
  state.connections = Array.from(
    { length: 12 },
    (_, index) =>
      ({
        id: String(index),
        metadata: { process: `process-${index}`, processPath: `C:\\process-${index}.exe` },
        chains: ['DIRECT'],
        rule: 'Match',
        rulePayload: '',
        downloadSpeed: 2048,
        uploadSpeed: 1024
      }) as ControllerConnectionDetail
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function flushQueuedFrames() {
  // React Flow's fitView uses a second frame scheduled by a layout effect.
  for (let pass = 0; pass < 10; pass++) {
    await act(async () => {
      await vi.runOnlyPendingTimersAsync()
    })
    if (!vi.getTimerCount()) return
  }
  throw new Error('Viewport update queue did not settle')
}

it('applies measured node changes and restores the actual viewport after zooming then rearranging', async () => {
  const { rerender } = render(<TopologyMap />)
  await flushQueuedFrames()
  const store = state.store!
  act(() => store.setState({ transform: [-900, -500, 2] }))
  expect(store.getState().transform[2]).toBe(2)
  fireEvent.click(screen.getByRole('button', { name: 'topology.rearrange' }))
  await flushQueuedFrames()
  expect(store.getState().transform[2], state.events.join('\n')).toBeLessThan(2)
  expect(store.getState().nodesInitialized).toBe(true)
  const [x, y, zoom] = store.getState().transform
  for (const node of store.getState().nodes) {
    expect(node.position.x * zoom + x).toBeGreaterThanOrEqual(0)
    expect(node.position.y * zoom + y).toBeGreaterThanOrEqual(0)
    expect((node.position.x + node.width!) * zoom + x).toBeLessThanOrEqual(800)
    expect((node.position.y + node.height!) * zoom + y).toBeLessThanOrEqual(480)
  }
  state.connections = state.connections.map((connection) => ({ ...connection, uploadSpeed: 9000 }))
  rerender(<TopologyMap />)
  await flushQueuedFrames()
  expect(store.getState().nodesInitialized).toBe(true)
  expect(store.getState().nodes.every((node) => node.measured?.width && node.measured.height)).toBe(
    true
  )
  state.connections = [
    ...state.connections,
    {
      ...state.connections[0],
      id: 'new',
      metadata: {
        ...state.connections[0].metadata,
        process: 'new-process',
        processPath: 'C:\\new-process.exe'
      }
    }
  ]
  rerender(<TopologyMap />)
  await flushQueuedFrames()
  expect(store.getState().nodesInitialized).toBe(true)
  act(() => store.setState({ transform: [-600, -400, 2] }))
  fireEvent.click(screen.getByRole('button', { name: 'topology.rearrange' }))
  await flushQueuedFrames()
  expect(
    store.getState().transform[2],
    JSON.stringify({
      events: state.events,
      queued: store.getState().fitViewQueued,
      initialized: store.getState().nodesInitialized,
      timers: vi.getTimerCount()
    })
  ).toBeLessThan(2)
})
