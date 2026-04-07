import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Viewport,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { useConnections } from '@renderer/hooks/use-connections'

import { nodeTypes } from './connections/topology/CustomNodes'
import { edgeTypes } from './connections/topology/AnimatedEdge'

interface TopologyNodeData {
  [key: string]: unknown
  name: string
  displayIcon?: boolean
  iconUrl?: string
  layerIndex: number
  policyGroups: Set<string>
  uploadSpeed?: number
  downloadSpeed?: number
  count?: number
}

interface TopologyGraph {
  structureKey: string
  nodes: Node<TopologyNodeData>[]
  edges: Edge[]
}

interface TopologyEdgeData {
  weight: number
  download: number
  upload: number
}

interface TopologyConnectionMeta {
  processName: string
  iconUrl: string
  displayIcon: boolean
  ruleLabel: string
  normalizedChain: string[]
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }
const TOPOLOGY_TRAFFIC_REFRESH_INTERVAL = 250

const EMPTY_GRAPH: TopologyGraph = {
  structureKey: '',
  nodes: [],
  edges: []
}

const LayoutHelper = ({
  structureKey,
  containerRef
}: {
  structureKey: string
  containerRef: React.RefObject<HTMLDivElement | null>
}) => {
  const { fitView } = useReactFlow()
  const fittedStructureRef = useRef('')
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const scheduleFitView = () => {
    window.requestAnimationFrame(() => {
      void fitView({ padding: 0.1, duration: 0 })
    })
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return
    }

    let timeout: ReturnType<typeof setTimeout> | null = null
    resizeObserverRef.current?.disconnect()
    resizeObserverRef.current = new ResizeObserver(() => {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        scheduleFitView()
      }, 16)
    })
    resizeObserverRef.current.observe(container)

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
    }
  }, [containerRef, fitView])

  useLayoutEffect(() => {
    if (!structureKey) {
      fittedStructureRef.current = ''
      return
    }

    if (fittedStructureRef.current === structureKey) {
      return
    }

    fittedStructureRef.current = structureKey
    scheduleFitView()
  }, [fitView, structureKey])

  return null
}

function getLayoutedElements(
  nodes: Node<TopologyNodeData>[],
  edges: Edge[],
  direction = 'LR'
): TopologyGraph {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, nodesep: 15, ranksep: 360, align: 'UL' })

  nodes.forEach((node) => {
    let width = 180
    let height = 56

    if (node.type === 'source') {
      width = 240
      height = 80
    }
    if (node.type === 'exit') {
      width = 230
      height = 90
    }

    dagreGraph.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  const columnSpacing = 450
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    const layerIndex = node.data.layerIndex || 1

    return {
      ...node,
      position: {
        x: (layerIndex - 1) * columnSpacing,
        y: Math.round(nodeWithPosition.y - nodeWithPosition.height / 2)
      },
      draggable: false,
      selectable: false
    }
  })

  return {
    structureKey: '',
    nodes: layoutedNodes,
    edges
  }
}

function normalizeConnectionChain(chain?: string[]): string[] {
  if (!chain || chain.length === 0) {
    return ['DIRECT', 'DIRECT']
  }

  const normalizedChain = [...chain].reverse().filter((item, index, items) => {
    return index === 0 || item !== items[index - 1]
  })

  if (normalizedChain.length === 1) {
    return [normalizedChain[0], normalizedChain[0]]
  }

  return normalizedChain
}

function getConnectionTopologyMeta(connection: ControllerConnectionDetail): TopologyConnectionMeta {
  let processName = 'Unknown'
  let iconUrl = ''
  let displayIcon = false

  if (connection.metadata.process) {
    const parts = connection.metadata.process.replace(/\\/g, '/').split('/')
    processName = parts[parts.length - 1]
    iconUrl = connection.metadata.processPath
      ? `http://127.0.0.1:3333/api/icon?path=${encodeURIComponent(connection.metadata.processPath)}`
      : ''
    displayIcon = !!iconUrl
  }

  let ruleLabel = connection.rulePayload ? connection.rulePayload : connection.rule
  if (!ruleLabel) ruleLabel = 'Match'
  if (ruleLabel.length > 25) ruleLabel = `${ruleLabel.substring(0, 23)}...`

  return {
    processName,
    iconUrl,
    displayIcon,
    ruleLabel,
    normalizedChain: normalizeConnectionChain(connection.chains)
  }
}

function buildTopologyStructureKey(connections: ControllerConnectionDetail[]): string {
  if (!connections.length) {
    return ''
  }

  const nodeKeys = new Set<string>()
  const edgeKeys = new Set<string>()
  let maxLayerIndex = 0

  connections.forEach((connection) => {
    const { processName, ruleLabel, normalizedChain } = getConnectionTopologyMeta(connection)
    const sourceNode = `${processName}__L1`
    const ruleNode = `${ruleLabel}__L2`

    nodeKeys.add(sourceNode)
    nodeKeys.add(ruleNode)
    edgeKeys.add(`${sourceNode}|${ruleNode}`)

    let previousNode = ruleNode
    normalizedChain.forEach((item, index) => {
      const layerIndex = 3 + index
      maxLayerIndex = Math.max(maxLayerIndex, layerIndex)

      const currentNode = `${item}__L${layerIndex}`
      nodeKeys.add(currentNode)
      edgeKeys.add(`${previousNode}|${currentNode}`)
      previousNode = currentNode
    })
  })

  return `${maxLayerIndex}__${Array.from(nodeKeys).sort().join(',')}__${Array.from(edgeKeys).sort().join(',')}`
}

function buildTopologyGraph(
  connections: ControllerConnectionDetail[],
  structureKey: string
): TopologyGraph {
  if (!connections.length || !structureKey) {
    return EMPTY_GRAPH
  }

  const nodesMap = new Map<string, Node<TopologyNodeData>>()
  const linksMap = new Map<string, TopologyEdgeData>()
  const nodeTraffic = new Map<string, { download: number; upload: number; count: number }>()
  const targetCounter = new Map<string, number>()
  const maxLayerIndex = Number.parseInt(structureKey.split('__', 1)[0] || '0', 10) || 0

  const addNode = (
    layerIndex: number,
    originalName: string,
    iconUrl?: string,
    displayIcon?: boolean,
    policyGroup?: string
  ) => {
    const uniqueName = `${originalName}__L${layerIndex}`

    if (!nodesMap.has(uniqueName)) {
      let type: Node['type'] = 'chain'
      if (layerIndex === 1) type = 'source'
      else if (layerIndex === 2) type = 'rule'

      nodesMap.set(uniqueName, {
        id: uniqueName,
        type,
        data: {
          name: originalName,
          displayIcon,
          iconUrl,
          layerIndex,
          policyGroups: policyGroup ? new Set([policyGroup]) : new Set()
        },
        position: { x: 0, y: 0 }
      })

      nodeTraffic.set(uniqueName, { download: 0, upload: 0, count: 0 })
    } else if (policyGroup) {
      nodesMap.get(uniqueName)?.data.policyGroups.add(policyGroup)
    }

    return uniqueName
  }

  const addLink = (source: string, target: string, upload: number, download: number) => {
    if (source === target) return

    const key = `${source}|${target}`
    if (!linksMap.has(key)) {
      linksMap.set(key, { weight: 0, download: 0, upload: 0 })
    }

    const current = linksMap.get(key)!
    current.weight += 1
    current.download += download
    current.upload += upload

    const sourceTraffic = nodeTraffic.get(source)
    if (sourceTraffic) {
      sourceTraffic.upload += upload
      sourceTraffic.count += 1
    }
  }

  connections.forEach((connection) => {
    const { processName, iconUrl, displayIcon, ruleLabel, normalizedChain } =
      getConnectionTopologyMeta(connection)
    const uploadSpeed = connection.uploadSpeed || 0
    const downloadSpeed = connection.downloadSpeed || 0

    const sourceNode = addNode(1, processName, iconUrl, displayIcon)
    const ruleNode = addNode(2, ruleLabel)

    addLink(sourceNode, ruleNode, uploadSpeed, downloadSpeed)
    targetCounter.set(ruleNode, (targetCounter.get(ruleNode) || 0) + 1)

    const ruleTraffic = nodeTraffic.get(ruleNode)
    if (ruleTraffic) {
      ruleTraffic.download += downloadSpeed
    }

    let previousNode = ruleNode
    const rootPolicyGroup = normalizedChain[0]

    normalizedChain.forEach((item, index) => {
      const layerIndex = 3 + index
      const currentNode = addNode(layerIndex, item, undefined, undefined, rootPolicyGroup)

      addLink(previousNode, currentNode, uploadSpeed, downloadSpeed)
      targetCounter.set(currentNode, (targetCounter.get(currentNode) || 0) + 1)

      const currentTraffic = nodeTraffic.get(currentNode)
      if (currentTraffic) {
        currentTraffic.download += downloadSpeed
      }

      previousNode = currentNode
    })
  })

  const nodes: Node<TopologyNodeData>[] = []
  nodesMap.forEach((node, id) => {
    const traffic = nodeTraffic.get(id)
    node.data.uploadSpeed = traffic?.upload || 0
    node.data.downloadSpeed = traffic?.download || 0
    node.data.count = node.data.layerIndex === 1 ? (traffic?.count || 0) : (targetCounter.get(id) || 0)

    if (node.data.layerIndex === maxLayerIndex && maxLayerIndex > 0) {
      node.type = 'exit'
    }

    nodes.push(node)
  })

  nodes.sort((left, right) => {
    const leftName = left.data.name
    const rightName = right.data.name

    if (leftName === 'DIRECT' && rightName !== 'DIRECT') return -1
    if (rightName === 'DIRECT' && leftName !== 'DIRECT') return 1
    if (leftName === 'REJECT' && rightName !== 'REJECT') return -1
    if (rightName === 'REJECT' && leftName !== 'REJECT') return 1

    return leftName.localeCompare(rightName)
  })

  const edges: Edge[] = []
  linksMap.forEach((value, key) => {
    const [source, target] = key.split('|')
    edges.push({
      id: `e-${source}-${target}`,
      source,
      target,
      type: 'animated',
      data: {
        weight: value.weight,
        upload: value.upload,
        download: value.download
      }
    })
  })

  edges.sort((left, right) => left.id.localeCompare(right.id))

  return {
    structureKey,
    nodes,
    edges
  }
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left === right) return true
  if (left.size !== right.size) return false

  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }

  return true
}

function hasSameNodeData(left: TopologyNodeData, right: TopologyNodeData): boolean {
  return (
    left.name === right.name &&
    left.displayIcon === right.displayIcon &&
    left.iconUrl === right.iconUrl &&
    left.layerIndex === right.layerIndex &&
    left.uploadSpeed === right.uploadSpeed &&
    left.downloadSpeed === right.downloadSpeed &&
    left.count === right.count &&
    areSetsEqual(left.policyGroups, right.policyGroups)
  )
}

function getEdgeData(edge: Edge): TopologyEdgeData {
  const data = (edge.data ?? {}) as Partial<TopologyEdgeData>

  return {
    weight: data.weight ?? 0,
    upload: data.upload ?? 0,
    download: data.download ?? 0
  }
}

function hasSameEdgeData(left: Edge, right: Edge): boolean {
  const leftData = getEdgeData(left)
  const rightData = getEdgeData(right)

  return (
    left.source === right.source &&
    left.target === right.target &&
    left.type === right.type &&
    leftData.weight === rightData.weight &&
    leftData.upload === rightData.upload &&
    leftData.download === rightData.download
  )
}

function mergeTopologyGraph(previousGraph: TopologyGraph, nextGraph: TopologyGraph): TopologyGraph {
  const previousNodeMap = new Map(previousGraph.nodes.map((node) => [node.id, node]))
  const previousEdgeMap = new Map(previousGraph.edges.map((edge) => [edge.id, edge]))

  return {
    structureKey: nextGraph.structureKey,
    nodes: nextGraph.nodes.map((node) => {
      const previousNode = previousNodeMap.get(node.id)
      if (!previousNode) {
        return node
      }

      if (previousNode.type === node.type && hasSameNodeData(previousNode.data, node.data)) {
        return previousNode
      }

      return {
        ...previousNode,
        type: node.type,
        data: node.data,
        draggable: false,
        selectable: false
      }
    }),
    edges: nextGraph.edges.map((edge) => {
      const previousEdge = previousEdgeMap.get(edge.id)
      if (!previousEdge) {
        return edge
      }

      if (hasSameEdgeData(previousEdge, edge)) {
        return previousEdge
      }

      return {
        ...previousEdge,
        data: edge.data
      }
    })
  }
}

function computeInitialViewport(
  nodes: Node<TopologyNodeData>[],
  container: HTMLDivElement | null
): Viewport | null {
  if (!nodes.length || !container) {
    return null
  }

  const width = container.clientWidth
  const height = container.clientHeight
  if (width <= 0 || height <= 0) {
    return null
  }

  const bounds = getNodesBounds(nodes)
  return getViewportForBounds(bounds, width, height, 0.05, 4, 0.1)
}

const TopologyMapInner = () => {
  const { connections } = useConnections()
  const structureKey = useMemo(() => buildTopologyStructureKey(connections), [connections])
  const [renderedGraph, setRenderedGraph] = useState<TopologyGraph>(EMPTY_GRAPH)
  const [initialViewport, setInitialViewport] = useState<Viewport | null>(null)
  const graphCacheRef = useRef<TopologyGraph>(EMPTY_GRAPH)
  const containerRef = useRef<HTMLDivElement>(null)
  const latestConnectionsRef = useRef<ControllerConnectionDetail[]>(connections)
  const latestStructureKeyRef = useRef(structureKey)
  const pendingTrafficTimeoutRef = useRef<number | null>(null)
  const lastGraphCommitAtRef = useRef(0)
  const viewportStructureKeyRef = useRef('')

  const clearPendingTrafficUpdate = useCallback(() => {
    if (pendingTrafficTimeoutRef.current !== null) {
      window.clearTimeout(pendingTrafficTimeoutRef.current)
      pendingTrafficTimeoutRef.current = null
    }
  }, [])

  const applyGraph = useCallback(
    (nextGraph: TopologyGraph, relayout: boolean) => {
      if (!nextGraph.nodes.length) {
        clearPendingTrafficUpdate()
        graphCacheRef.current = EMPTY_GRAPH
        lastGraphCommitAtRef.current = 0
        setRenderedGraph(EMPTY_GRAPH)
        return
      }

      const graphToRender = relayout
        ? (() => {
            const layoutedGraph = getLayoutedElements(nextGraph.nodes, nextGraph.edges)
            return {
              structureKey: nextGraph.structureKey,
              nodes: layoutedGraph.nodes,
              edges: layoutedGraph.edges
            }
          })()
        : mergeTopologyGraph(graphCacheRef.current, nextGraph)

      graphCacheRef.current = graphToRender
      lastGraphCommitAtRef.current = Date.now()
      setRenderedGraph(graphToRender)
    },
    [clearPendingTrafficUpdate]
  )

  const flushPendingTrafficUpdate = useCallback(() => {
    if (pendingTrafficTimeoutRef.current !== null) {
      window.clearTimeout(pendingTrafficTimeoutRef.current)
      pendingTrafficTimeoutRef.current = null
    }

    const nextConnections = latestConnectionsRef.current
    const nextStructureKey = latestStructureKeyRef.current
    if (!nextConnections.length || !nextStructureKey) {
      return
    }

    applyGraph(buildTopologyGraph(nextConnections, nextStructureKey), false)
  }, [applyGraph])

  useEffect(() => {
    latestConnectionsRef.current = connections
    latestStructureKeyRef.current = structureKey

    if (!connections.length || !structureKey) {
      clearPendingTrafficUpdate()
      graphCacheRef.current = EMPTY_GRAPH
      lastGraphCommitAtRef.current = 0
      setRenderedGraph(EMPTY_GRAPH)
      return
    }

    const structureChanged = graphCacheRef.current.structureKey !== structureKey

    if (structureChanged) {
      clearPendingTrafficUpdate()
      applyGraph(buildTopologyGraph(connections, structureKey), true)
      return
    }

    const elapsed = Date.now() - lastGraphCommitAtRef.current
    if (elapsed >= TOPOLOGY_TRAFFIC_REFRESH_INTERVAL) {
      flushPendingTrafficUpdate()
      return
    }

    if (pendingTrafficTimeoutRef.current === null) {
      pendingTrafficTimeoutRef.current = window.setTimeout(() => {
        flushPendingTrafficUpdate()
      }, TOPOLOGY_TRAFFIC_REFRESH_INTERVAL - elapsed)
    }
  }, [
    applyGraph,
    clearPendingTrafficUpdate,
    connections,
    flushPendingTrafficUpdate,
    structureKey
  ])

  useEffect(() => {
    return () => {
      clearPendingTrafficUpdate()
    }
  }, [clearPendingTrafficUpdate])

  useLayoutEffect(() => {
    if (!renderedGraph.nodes.length) {
      viewportStructureKeyRef.current = ''
      setInitialViewport(null)
      return
    }

    if (viewportStructureKeyRef.current === renderedGraph.structureKey) {
      return
    }

    const viewport = computeInitialViewport(renderedGraph.nodes, containerRef.current)
    if (!viewport) {
      return
    }

    viewportStructureKeyRef.current = renderedGraph.structureKey
    setInitialViewport(viewport)
  }, [renderedGraph.nodes, renderedGraph.structureKey])

  return (
    <div ref={containerRef} className="h-full w-full relative">
      {connections.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-full text-default-400 gap-3 opacity-60">
          <div className="text-4xl grayscale">[]</div>
          <div className="text-sm font-medium">No active connections</div>
        </div>
      ) : renderedGraph.nodes.length === 0 || !initialViewport ? (
        <div className="flex justify-center items-center h-full text-default-400 text-sm">
          Building topology...
        </div>
      ) : (
        <ReactFlow
          nodes={renderedGraph.nodes}
          edges={renderedGraph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes as never}
          minZoom={0.05}
          maxZoom={4}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          defaultEdgeOptions={{ type: 'animated', interactionWidth: 0 }}
          proOptions={{ hideAttribution: true }}
          defaultViewport={initialViewport ?? DEFAULT_VIEWPORT}
        >
          <LayoutHelper structureKey={renderedGraph.structureKey} containerRef={containerRef} />
          <Background color="transparent" gap={20} size={0} />
          <Controls
            showInteractive={false}
            className="topology-controls opacity-50 hover:opacity-100 border-none shadow-md overflow-hidden rounded-lg mx-4"
          />
        </ReactFlow>
      )}
    </div>
  )
}

const TopologyMap: React.FC = () => {
  return (
    <ReactFlowProvider>
      <TopologyMapInner />
    </ReactFlowProvider>
  )
}

export default TopologyMap
