import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

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

const getLayoutedElements = (nodes: Node<TopologyNodeData>[], edges: Edge[], direction = 'LR') => {
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
  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    const layerIdx = node.data.layerIndex || 1
    const targetX = (layerIdx - 1) * columnSpacing

    return {
      ...node,
      position: {
        x: targetX,
        y: Math.round(nodeWithPosition.y - nodeWithPosition.height / 2)
      },
      draggable: false,
      selectable: false
    }
  })

  return { nodes: newNodes, edges }
}

function buildTopologyGraph(connections: ControllerConnectionDetail[]): TopologyGraph {
  if (!connections || connections.length === 0) {
    return EMPTY_GRAPH
  }

  const nodesMap = new Map<string, Node<TopologyNodeData>>()
  const linksMap = new Map<string, { weight: number; download: number; upload: number }>()
  const nodeTraffic = new Map<string, { download: number; upload: number; count: number }>()
  const targetCounter = new Map<string, number>()
  let maxLayerIndex = 0

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

  connections.forEach((conn) => {
    const uploadSpeed = conn.uploadSpeed || 0
    const downloadSpeed = conn.downloadSpeed || 0

    let processName = 'Unknown'
    let iconUrl = ''
    let displayIcon = false

    if (conn.metadata.process) {
      const parts = conn.metadata.process.replace(/\\/g, '/').split('/')
      processName = parts[parts.length - 1]
      iconUrl = conn.metadata.processPath
        ? `http://127.0.0.1:3333/api/icon?path=${encodeURIComponent(conn.metadata.processPath)}`
        : ''
      displayIcon = !!iconUrl
    }

    const sourceNode = addNode(1, processName, iconUrl, displayIcon)

    let ruleLabel = conn.rulePayload ? conn.rulePayload : conn.rule
    if (!ruleLabel) ruleLabel = 'Match'
    if (ruleLabel.length > 25) ruleLabel = `${ruleLabel.substring(0, 23)}...`
    const ruleNode = addNode(2, ruleLabel)

    addLink(sourceNode, ruleNode, uploadSpeed, downloadSpeed)
    targetCounter.set(ruleNode, (targetCounter.get(ruleNode) || 0) + 1)

    const ruleTraffic = nodeTraffic.get(ruleNode)
    if (ruleTraffic) {
      ruleTraffic.download += downloadSpeed
    }

    const chain = conn.chains
    let normalizedChain: string[] = []

    if (!chain || chain.length === 0) {
      normalizedChain = ['DIRECT', 'DIRECT']
    } else {
      normalizedChain = [...chain].reverse()
      normalizedChain = normalizedChain.filter((item, index) => {
        return index === 0 || item !== normalizedChain[index - 1]
      })
      if (normalizedChain.length === 1) {
        normalizedChain = [normalizedChain[0], normalizedChain[0]]
      }
    }

    let previousNode = ruleNode
    const rootPolicyGroup = normalizedChain[0]

    normalizedChain.forEach((item, index) => {
      const currentLayer = 3 + index
      if (currentLayer > maxLayerIndex) {
        maxLayerIndex = currentLayer
      }

      const currentNode = addNode(currentLayer, item, undefined, undefined, rootPolicyGroup)

      addLink(previousNode, currentNode, uploadSpeed, downloadSpeed)
      targetCounter.set(currentNode, (targetCounter.get(currentNode) || 0) + 1)

      const currentTraffic = nodeTraffic.get(currentNode)
      if (currentTraffic) {
        currentTraffic.download += downloadSpeed
      }

      previousNode = currentNode
    })
  })

  const initialNodes: Node<TopologyNodeData>[] = []
  nodesMap.forEach((node, id) => {
    const traffic = nodeTraffic.get(id)
    node.data.uploadSpeed = traffic?.upload || 0
    node.data.downloadSpeed = traffic?.download || 0
    node.data.count = node.data.layerIndex === 1 ? (traffic?.count || 0) : (targetCounter.get(id) || 0)

    if (node.data.layerIndex === maxLayerIndex && maxLayerIndex > 0) {
      node.type = 'exit'
    }

    initialNodes.push(node)
  })

  initialNodes.sort((left, right) => {
    const leftName = left.data.name
    const rightName = right.data.name

    if (leftName === 'DIRECT' && rightName !== 'DIRECT') return -1
    if (rightName === 'DIRECT' && leftName !== 'DIRECT') return 1
    if (leftName === 'REJECT' && rightName !== 'REJECT') return -1
    if (rightName === 'REJECT' && leftName !== 'REJECT') return 1

    return leftName.localeCompare(rightName)
  })

  const initialEdges: Edge[] = []
  linksMap.forEach((value, key) => {
    const [source, target] = key.split('|')
    initialEdges.push({
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

  initialEdges.sort((left, right) => left.id.localeCompare(right.id))

  return {
    structureKey: `${initialNodes.map((node) => `${node.id}:${node.type}`).join(',')}__${initialEdges.map((edge) => edge.id).join(',')}`,
    nodes: initialNodes,
    edges: initialEdges
  }
}

const TopologyMapInner = () => {
  const { connections } = useConnections()
  const topologyGraph = useMemo(() => buildTopologyGraph(connections), [connections])
  const [renderedGraph, setRenderedGraph] = useState<TopologyGraph>(EMPTY_GRAPH)
  const [initialViewport, setInitialViewport] = useState<Viewport | null>(null)
  const graphCacheRef = useRef<TopologyGraph>(EMPTY_GRAPH)
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!topologyGraph.nodes.length) {
      setInitialViewport(null)
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    const width = container.clientWidth
    const height = container.clientHeight

    if (width <= 0 || height <= 0) {
      return
    }

    const bounds = getNodesBounds(topologyGraph.nodes)
    const viewport = getViewportForBounds(bounds, width, height, 0.05, 4, 0.1)
    setInitialViewport(viewport)
  }, [topologyGraph.nodes])

  useEffect(() => {
    if (!topologyGraph.nodes.length) {
      graphCacheRef.current = EMPTY_GRAPH
      setRenderedGraph(EMPTY_GRAPH)
      return
    }

    const previousGraph = graphCacheRef.current

    if (previousGraph.structureKey !== topologyGraph.structureKey) {
      const layoutedGraph = getLayoutedElements(topologyGraph.nodes, topologyGraph.edges)
      const nextGraph = {
        structureKey: topologyGraph.structureKey,
        nodes: layoutedGraph.nodes,
        edges: layoutedGraph.edges
      }

      graphCacheRef.current = nextGraph
      setRenderedGraph(nextGraph)
      return
    }

    const previousNodeMap = new Map(previousGraph.nodes.map((node) => [node.id, node]))
    const previousEdgeMap = new Map(previousGraph.edges.map((edge) => [edge.id, edge]))

    const nextGraph: TopologyGraph = {
      structureKey: topologyGraph.structureKey,
      nodes: topologyGraph.nodes.map((node) => {
        const previousNode = previousNodeMap.get(node.id)
        if (!previousNode) {
          return node
        }

        return {
          ...node,
          type: previousNode.type,
          position: previousNode.position,
          draggable: false,
          selectable: false
        }
      }),
      edges: topologyGraph.edges.map((edge) => {
        const previousEdge = previousEdgeMap.get(edge.id)
        if (!previousEdge) {
          return edge
        }

        return {
          ...previousEdge,
          data: edge.data
        }
      })
    }

    graphCacheRef.current = nextGraph
    setRenderedGraph(nextGraph)
  }, [topologyGraph])

  return (
    <div ref={containerRef} className="h-full w-full relative">
      {connections.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-full text-default-400 gap-3 opacity-60">
          <div className="text-4xl grayscale">🕸️</div>
          <div className="text-sm font-medium">暂无活动连接</div>
        </div>
      ) : renderedGraph.nodes.length === 0 || !initialViewport ? (
        <div className="flex justify-center items-center h-full text-default-400 text-sm">
          解析数据结构中...
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
