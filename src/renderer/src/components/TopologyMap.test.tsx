// @vitest-environment jsdom
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TopologyGraph } from './connections/topology/graph'
import TopologyMap from './TopologyMap'
import type { Viewport } from '@xyflow/react'

const mocks = vi.hoisted(() => ({
  connections: [] as ControllerConnectionDetail[],
  loading: false,
  graph: null as Pick<TopologyGraph, 'nodes' | 'edges'> | null,
  initialized: true,
  viewport: undefined as Viewport | undefined,
  minZoom: 0,
  canvasWidth: 800,
  canvasHeight: 480,
  resize: undefined as (() => void) | undefined,
  fitView: vi.fn()
}))
vi.mock('@renderer/hooks/use-connections', () => ({ useConnections: () => mocks }))
vi.mock('@renderer/i18n', async () => {
  const { zhCN } = await import('../i18n/locales/zh-CN')
  return {
    useI18n: () => ({
      t: (key: keyof typeof zhCN, values: Record<string, string | number> = {}) =>
        zhCN[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]))
    })
  }
})
vi.mock('@heroui/react', () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    startContent,
    'aria-pressed': pressed
  }: PropsWithChildren<
    ButtonHTMLAttributes<HTMLButtonElement> & {
      onPress?: () => void
      isDisabled?: boolean
      startContent?: React.ReactNode
    }
  >) => (
    <button onClick={onPress} disabled={isDisabled} aria-pressed={pressed}>
      {startContent}
      {children}
    </button>
  ),
  Input: ({
    value,
    onValueChange,
    ...props
  }: {
    value: string
    onValueChange: (value: string) => void
    'aria-label': string
  }) => (
    <input
      aria-label={props['aria-label']}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
  Spinner: () => <span />
}))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  ReactFlowProvider: ({ children }: PropsWithChildren) => <>{children}</>,
  ReactFlow: ({
    children,
    nodes,
    edges,
    defaultViewport,
    minZoom
  }: PropsWithChildren<
    Pick<TopologyGraph, 'nodes' | 'edges'> & { defaultViewport?: Viewport; minZoom: number }
  >) => {
    mocks.graph = { nodes, edges }
    mocks.viewport = defaultViewport
    mocks.minZoom = minZoom
    return <div data-testid="topology-graph">{children}</div>
  },
  Controls: () => null,
  useReactFlow: () => ({ fitView: mocks.fitView, viewportInitialized: true }),
  useNodesInitialized: () => mocks.initialized
}))
vi.mock('./connections/topology/CustomNodes', () => ({ nodeTypes: {} }))
vi.mock('./connections/topology/AnimatedEdge', () => ({ edgeTypes: {} }))

function connection(id: string): ControllerConnectionDetail {
  return {
    id,
    metadata: { process: id + '.exe', processPath: 'C:\\' + id + '.exe', host: id + '.test' },
    chains: ['DIRECT'],
    rule: 'Match',
    rulePayload: '',
    uploadSpeed: 10,
    downloadSpeed: 20
  } as ControllerConnectionDetail
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-19T00:00:00Z'))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0)
  )
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  mocks.connections = [connection('first')]
  mocks.loading = false
  mocks.initialized = true
  mocks.fitView.mockReset()
  mocks.graph = null
  mocks.viewport = undefined
  mocks.canvasWidth = 800
  mocks.canvasHeight = 480
  mocks.resize = undefined
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => mocks.canvasWidth)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => mocks.canvasHeight
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        mocks.resize = callback
      }
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('topology interaction state', () => {
  it('starts with every connection inside the canvas, even below the previous minimum zoom', () => {
    mocks.connections = Array.from({ length: 120 }, (_, index) => connection(`process-${index}`))
    render(<TopologyMap />)
    expect(mocks.graph?.nodes.filter((node) => node.type === 'source')).toHaveLength(120)
    expect(mocks.viewport).toBeDefined()
    const viewport = mocks.viewport!
    expect(viewport.zoom).toBeLessThan(0.05)
    expect(mocks.minZoom).toBeLessThanOrEqual(viewport.zoom)
    for (const node of mocks.graph!.nodes) {
      expect(node.position.x * viewport.zoom + viewport.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y * viewport.zoom + viewport.y).toBeGreaterThanOrEqual(0)
      expect((node.position.x + node.width!) * viewport.zoom + viewport.x).toBeLessThanOrEqual(
        mocks.canvasWidth
      )
      expect((node.position.y + node.height!) * viewport.zoom + viewport.y).toBeLessThanOrEqual(
        mocks.canvasHeight
      )
    }
  })

  it('waits for a visible canvas before choosing the initial viewport', () => {
    mocks.canvasWidth = 0
    mocks.canvasHeight = 0
    render(<TopologyMap />)
    expect(screen.queryByTestId('topology-graph')).toBeNull()
    mocks.canvasWidth = 800
    mocks.canvasHeight = 480
    act(() => mocks.resize?.())
    expect(screen.getByTestId('topology-graph')).toBeTruthy()
    expect(mocks.viewport).toBeDefined()
  })
  it('freezes only this view while paused and resumes with the latest connections', () => {
    const { rerender } = render(<TopologyMap />)
    act(() => vi.advanceTimersByTime(250))
    fireEvent.click(screen.getByRole('button', { name: '暂停刷新' }))
    mocks.connections = [connection('first'), connection('second')]
    rerender(<TopologyMap />)
    act(() => vi.advanceTimersByTime(250))
    expect(mocks.graph?.nodes.filter((node) => node.type === 'source')).toHaveLength(1)
    expect(screen.getByText('已暂停刷新')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '继续刷新' }))
    act(() => vi.advanceTimersByTime(250))
    expect(mocks.graph?.nodes.filter((node) => node.type === 'source')).toHaveLength(2)
  })

  it('fits after measurement and on rearrange, preserving the viewport during structural updates', () => {
    mocks.initialized = false
    const { rerender } = render(<TopologyMap />)
    act(() => vi.advanceTimersByTime(250))
    expect(mocks.fitView).not.toHaveBeenCalled()
    mocks.initialized = true
    rerender(<TopologyMap />)
    act(() => vi.advanceTimersByTime(1))
    expect(mocks.fitView).toHaveBeenCalledTimes(1)
    mocks.connections = [connection('first'), connection('second')]
    rerender(<TopologyMap />)
    act(() => vi.advanceTimersByTime(250))
    expect(mocks.fitView).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'first' } })
    act(() => vi.advanceTimersByTime(1))
    expect(mocks.fitView).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '重新布局' }))
    act(() => vi.advanceTimersByTime(1))
    expect(mocks.fitView).toHaveBeenCalledTimes(3)
  })

  it('distinguishes loading, empty and search-empty states and clears pending updates on unmount', () => {
    mocks.connections = []
    mocks.loading = true
    const { rerender, unmount } = render(<TopologyMap />)
    expect(screen.getByRole('status').textContent).toContain('正在构建拓扑')
    expect(screen.queryByText('暂无活动连接')).toBeNull()
    mocks.loading = false
    rerender(<TopologyMap />)
    expect(screen.getByText('暂无活动连接')).toBeTruthy()
    mocks.connections = [connection('first')]
    rerender(<TopologyMap />)
    act(() => vi.advanceTimersByTime(250))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'missing' } })
    expect(screen.getByText('没有匹配的连接')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    mocks.connections = [connection('second')]
    rerender(<TopologyMap />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
