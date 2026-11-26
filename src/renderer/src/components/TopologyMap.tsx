import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  ReactFlow,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
  getNodesBounds,
  getViewportForBounds,
  applyNodeChanges,
  type NodeChange,
  type FitViewOptions
} from '@xyflow/react'
import { Button, Input, Spinner } from '@heroui/react'
import {
  LuArrowDown,
  LuArrowUp,
  LuNetwork,
  LuPause,
  LuPlay,
  LuSearch,
  LuLayoutDashboard
} from 'react-icons/lu'
import '@xyflow/react/dist/style.css'
import { useConnections } from '@renderer/hooks/use-connections'
import { useI18n } from '@renderer/i18n'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { nodeTypes } from './connections/topology/CustomNodes'
import { edgeTypes } from './connections/topology/AnimatedEdge'
import {
  buildTopologyGraph,
  EMPTY_GRAPH,
  filterTopologyConnections,
  layoutTopologyGraph,
  mergeTopologyGraph,
  type TopologyGraph,
  type TopologyNode
} from './connections/topology/graph'

const REFRESH_INTERVAL = 250
const FIT_VIEW_PADDING = 0.05
// Refit on canvas resize or explicit requests, preserving the view during traffic updates.
function ViewportHelper({ fitKey, options }: { fitKey: string; options: FitViewOptions }) {
  const { fitView, viewportInitialized } = useReactFlow()
  const initialized = useNodesInitialized()
  const fittedRequest = useRef<string | null>(null)
  useEffect(() => {
    if (!initialized || !viewportInitialized || fittedRequest.current === fitKey) return
    const frame = requestAnimationFrame(() => {
      fittedRequest.current = fitKey
      void fitView(options)
    })
    return () => cancelAnimationFrame(frame)
  }, [fitKey, fitView, initialized, options, viewportInitialized])
  return null
}

function TopologyMapInner() {
  const { connections, loading } = useConnections()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [pausedSnapshot, setPausedSnapshot] = useState<ControllerConnectionDetail[] | null>(null)
  const paused = pausedSnapshot !== null
  const source = pausedSnapshot ?? connections
  const filtered = useMemo(
    () => filterTopologyConnections(source, deferredQuery),
    [source, deferredQuery]
  )
  const [graph, setGraph] = useState<TopologyGraph>(EMPTY_GRAPH)
  const graphRef = useRef(EMPTY_GRAPH)
  const latestConnections = useRef(filtered)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCommit = useRef(0)
  const previousQuery = useRef(deferredQuery)
  const [fitRequest, setFitRequest] = useState(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const onNodesChange = useCallback((changes: NodeChange<TopologyNode>[]) => {
    // Controlled nodes must retain React Flow's measured dimensions.
    const next = { ...graphRef.current, nodes: applyNodeChanges(changes, graphRef.current.nodes) }
    graphRef.current = next
    setGraph(next)
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const measure = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      setCanvasSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const initialViewport = useMemo(() => {
    if (!graph.nodes.length || !canvasSize.width || !canvasSize.height) return null
    return getViewportForBounds(
      getNodesBounds(graph.nodes),
      canvasSize.width,
      canvasSize.height,
      0,
      1,
      FIT_VIEW_PADDING
    )
  }, [canvasSize, graph.nodes])
  const minimumZoom = Math.min(0.05, initialViewport?.zoom ?? 0.05)
  const fitOptions = useMemo<FitViewOptions>(
    () => ({
      padding: FIT_VIEW_PADDING,
      minZoom: minimumZoom,
      maxZoom: 1,
      duration: 0
    }),
    [minimumZoom]
  )

  const commitGraph = useCallback(() => {
    pending.current = null
    const next = buildTopologyGraph(latestConnections.current)
    const previous = graphRef.current
    const updated =
      next.structureKey === previous.structureKey
        ? mergeTopologyGraph(previous, next)
        : layoutTopologyGraph(next, previous)
    graphRef.current = updated
    lastCommit.current = Date.now()
    setGraph(updated)
  }, [])

  useEffect(() => {
    latestConnections.current = filtered
    const searchChanged = previousQuery.current !== deferredQuery
    previousQuery.current = deferredQuery
    const elapsed = Date.now() - lastCommit.current
    if (searchChanged || !filtered.length || elapsed >= REFRESH_INTERVAL) {
      if (pending.current !== null) clearTimeout(pending.current)
      commitGraph()
      if (searchChanged) setFitRequest((value) => value + 1)
    } else if (pending.current === null) {
      pending.current = setTimeout(commitGraph, REFRESH_INTERVAL - elapsed)
    }
  }, [commitGraph, deferredQuery, filtered])

  useEffect(
    () => () => {
      if (pending.current !== null) clearTimeout(pending.current)
    },
    []
  )

  const rearrange = () => {
    if (pending.current !== null) clearTimeout(pending.current)
    pending.current = null
    const next = layoutTopologyGraph(
      mergeTopologyGraph(graphRef.current, buildTopologyGraph(latestConnections.current))
    )
    graphRef.current = next
    lastCommit.current = Date.now()
    setGraph(next)
    setFitRequest((value) => value + 1)
  }
  const hasGraph = graph.nodes.length > 0
  const waiting =
    (loading && !source.length && !paused) ||
    (filtered.length > 0 && (!hasGraph || !initialViewport))
  const processCount = graph.nodes.filter((node) => node.type === 'source').length

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="px-2.5 pt-2.5 pb-1.5">
        <div
          className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 ${CARD_STYLES.GLASS_TOOLBAR}`}
        >
          <div className="flex shrink-0 items-center gap-x-3 px-1 text-xs text-default-500">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-warning' : waiting ? 'bg-default-400' : 'bg-success'}`}
              />
              {t(paused ? 'topology.paused' : waiting ? 'topology.loading' : 'topology.live')}
            </span>
            <span className="tabular-nums">
              {t('topology.connections', { count: graph.connectionCount })}
            </span>
            <span className="tabular-nums">{t('topology.processes', { count: processCount })}</span>
          </div>
          <div className="hidden md:block w-[1px] h-4 bg-default-200/50 dark:bg-white/10" />
          <Input
            aria-label={t('topology.search')}
            placeholder={t('topology.search')}
            value={query}
            onValueChange={setQuery}
            isClearable
            onClear={() => setQuery('')}
            variant="flat"
            size="sm"
            startContent={<LuSearch className="shrink-0 text-default-400" aria-hidden />}
            className="min-w-[160px] flex-1"
            classNames={CARD_STYLES.GLASS_INPUT}
          />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-2.5 px-1 text-xs text-default-500 tabular-nums">
              <span
                className="inline-flex items-center gap-1"
                title={t('connections.column.downloadSpeed')}
              >
                <LuArrowDown className="text-success" aria-hidden />
                {calcTraffic(graph.downloadSpeed)}/s
              </span>
              <span
                className="inline-flex items-center gap-1"
                title={t('connections.column.uploadSpeed')}
              >
                <LuArrowUp className="text-primary" aria-hidden />
                {calcTraffic(graph.uploadSpeed)}/s
              </span>
            </span>
            <div className="w-[1px] h-4 bg-default-200/50 dark:bg-white/10" />
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={paused ? 'flat' : 'light'}
                color={paused ? 'warning' : 'default'}
                className={CARD_STYLES.GLASS_TOOLBAR_BUTTON}
                startContent={paused ? <LuPlay aria-hidden /> : <LuPause aria-hidden />}
                onPress={() => setPausedSnapshot(paused ? null : connections)}
                aria-pressed={paused}
              >
                {t(paused ? 'connections.resume' : 'connections.pause')}
              </Button>
              <Button
                size="sm"
                variant="light"
                isDisabled={!hasGraph}
                className={CARD_STYLES.GLASS_TOOLBAR_BUTTON}
                startContent={<LuLayoutDashboard aria-hidden />}
                onPress={rearrange}
              >
                {t('topology.rearrange')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div ref={canvasRef} className="relative min-h-0 flex-1" aria-label={t('page.map.title')}>
        {waiting ? (
          <div
            className="flex h-full items-center justify-center gap-2 text-sm text-default-500"
            role="status"
          >
            <Spinner size="sm" />
            {t('topology.loading')}
          </div>
        ) : !hasGraph || !initialViewport ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <LuNetwork className="mb-1 h-8 w-8 text-default-300" aria-hidden />
            <span className="text-sm font-medium text-default-600">
              {t(deferredQuery.trim() ? 'topology.noResults' : 'connections.emptyActive')}
            </span>
            <span className="text-xs text-default-400">
              {t(deferredQuery.trim() ? 'topology.noResultsHint' : 'topology.emptyHint')}
            </span>
          </div>
        ) : (
          <ReactFlow
            nodes={graph.nodes}
            onNodesChange={onNodesChange}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultViewport={initialViewport}
            minZoom={minimumZoom}
            maxZoom={2}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            defaultEdgeOptions={{ type: 'traffic', interactionWidth: 0 }}
            proOptions={{ hideAttribution: true }}
            ariaLabelConfig={{
              'controls.zoomIn.ariaLabel': t('topology.zoomIn'),
              'controls.zoomOut.ariaLabel': t('topology.zoomOut'),
              'controls.fitView.ariaLabel': t('topology.fitView')
            }}
          >
            <ViewportHelper
              fitKey={`${fitRequest}:${canvasSize.width}:${canvasSize.height}`}
              options={fitOptions}
            />
            <Controls
              showInteractive={false}
              orientation="horizontal"
              fitViewOptions={fitOptions}
              aria-label={t('topology.controls')}
              className="topology-controls"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

export default function TopologyMap() {
  return (
    <ReactFlowProvider>
      <TopologyMapInner />
    </ReactFlowProvider>
  )
}
