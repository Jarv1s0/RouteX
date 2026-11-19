import type { Edge, Node } from '@xyflow/react'
import dagre from 'dagre'

export interface TopologyNodeData extends Record<string, unknown> {
  name: string
  detail: string
  layerIndex: number
  iconUrl?: string
  policyGroups: string[]
  uploadSpeed: number
  downloadSpeed: number
  count: number
}

export interface TopologyEdgeData extends Record<string, unknown> {
  weight: number
  download: number
  upload: number
}

export type TopologyNode = Node<TopologyNodeData, 'source' | 'rule' | 'chain' | 'exit'>
export type TopologyEdge = Edge<TopologyEdgeData, 'traffic'>

export interface TopologyGraph {
  structureKey: string
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  connectionCount: number
  uploadSpeed: number
  downloadSpeed: number
}

export const EMPTY_GRAPH: TopologyGraph = {
  structureKey: '',
  nodes: [],
  edges: [],
  connectionCount: 0,
  uploadSpeed: 0,
  downloadSpeed: 0
}

const COLUMN_SPACING = 450
const NODE_GAP = 20

function normalizeChain(chain: string[]): string[] {
  const result = [...(chain || [])]
    .reverse()
    .filter((item, index, items) => item && (index === 0 || item !== items[index - 1]))
  return result.length ? result : ['DIRECT']
}

export function filterTopologyConnections(
  connections: ControllerConnectionDetail[],
  query: string
): ControllerConnectionDetail[] {
  const search = query.trim().toLocaleLowerCase()
  if (!search) return connections
  return connections.filter((connection) =>
    [
      connection.metadata.process,
      connection.metadata.processPath,
      connection.metadata.host,
      connection.metadata.destinationIP,
      connection.rule,
      connection.rulePayload,
      ...(connection.chains || [])
    ].some((value) => value?.toLocaleLowerCase().includes(search))
  )
}

export function buildTopologyGraph(connections: ControllerConnectionDetail[]): TopologyGraph {
  if (!connections.length) return EMPTY_GRAPH
  const chains = connections.map((connection) => normalizeChain(connection.chains))
  const exitLayer = 2 + chains.reduce((maximum, chain) => Math.max(maximum, chain.length), 1)
  const nodes = new Map<string, TopologyNode>()
  const edges = new Map<string, TopologyEdge>()
  let uploadSpeed = 0
  let downloadSpeed = 0

  const addNode = (
    type: TopologyNode['type'],
    name: string,
    identity: string,
    layerIndex: number,
    detail = '',
    iconUrl?: string
  ): TopologyNode => {
    // React Flow also interpolates IDs into quoted DOM attribute selectors.
    const id = encodeURIComponent(JSON.stringify([type, identity, layerIndex]))
    let node = nodes.get(id)
    if (!node) {
      node = {
        id,
        type,
        width: type === 'source' ? 240 : type === 'exit' ? 230 : 180,
        height: type === 'source' ? 80 : type === 'exit' ? 92 : 56,
        position: { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          name,
          detail,
          iconUrl,
          layerIndex,
          policyGroups: [],
          uploadSpeed: 0,
          downloadSpeed: 0,
          count: 0
        }
      }
      nodes.set(id, node)
    }
    return node
  }

  connections.forEach((connection, index) => {
    const { metadata } = connection
    const process = metadata.process || metadata.processPath || ''
    const name = process.replace(/\\/g, '/').split('/').at(-1) || ''
    const source = addNode(
      'source',
      name,
      metadata.processPath || process,
      1,
      metadata.processPath || process,
      metadata.processPath
        ? `http://127.0.0.1:3333/api/icon?path=${encodeURIComponent(metadata.processPath)}`
        : undefined
    )
    const rule = addNode(
      'rule',
      connection.rulePayload || connection.rule || 'MATCH',
      JSON.stringify([connection.rule, connection.rulePayload]),
      2,
      connection.rule || 'MATCH'
    )
    const chain = chains[index]
    const path = [
      source,
      rule,
      ...chain.map((item, chainIndex) => {
        const terminal = chainIndex === chain.length - 1
        const node = addNode(
          terminal ? 'exit' : 'chain',
          item,
          item,
          terminal ? exitLayer : 3 + chainIndex
        )
        if (terminal && chain.length > 1 && !node.data.policyGroups.includes(chain[0])) {
          node.data.policyGroups.push(chain[0])
        }
        return node
      })
    ]
    const upload = Math.max(0, connection.uploadSpeed || 0)
    const download = Math.max(0, connection.downloadSpeed || 0)
    uploadSpeed += upload
    downloadSpeed += download
    // Count each connection once at every stage, including both endpoints.
    for (const node of path) {
      node.data.uploadSpeed += upload
      node.data.downloadSpeed += download
      node.data.count++
    }
    for (let step = 1; step < path.length; step++) {
      const source = path[step - 1].id
      const target = path[step].id
      const id = encodeURIComponent(JSON.stringify([source, target]))
      let edge = edges.get(id)
      if (!edge) {
        edge = { id, source, target, type: 'traffic', data: { weight: 0, upload: 0, download: 0 } }
        edges.set(id, edge)
      }
      edge.data!.weight++
      edge.data!.upload += upload
      edge.data!.download += download
    }
  })

  const sortedNodes = [...nodes.values()].sort(
    (a, b) => a.data.layerIndex - b.data.layerIndex || a.id.localeCompare(b.id)
  )
  for (const node of sortedNodes) node.data.policyGroups.sort()
  const sortedEdges = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id))
  return {
    structureKey: JSON.stringify([
      sortedNodes.map((node) => node.id),
      sortedEdges.map((edge) => edge.id)
    ]),
    nodes: sortedNodes,
    edges: sortedEdges,
    connectionCount: connections.length,
    uploadSpeed,
    downloadSpeed
  }
}

export function layoutTopologyGraph(graph: TopologyGraph, previous = EMPTY_GRAPH): TopologyGraph {
  if (!graph.nodes.length) return graph
  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]))
  const retained = graph.nodes.filter((node) => previousNodes.has(node.id))
  const bottomByLayer = new Map<number, number>()
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of retained) {
    const position = previousNodes.get(node.id)!.position
    positions.set(node.id, position)
    bottomByLayer.set(
      node.data.layerIndex,
      Math.max(bottomByLayer.get(node.data.layerIndex) || 0, position.y + node.height! + NODE_GAP)
    )
  }
  // Full layout is needed only on first load or an explicit rearrange request.
  if (!retained.length) {
    const layout = new dagre.graphlib.Graph()
    layout.setDefaultEdgeLabel(() => ({}))
    layout.setGraph({ rankdir: 'LR', nodesep: NODE_GAP, ranksep: 80, align: 'UL' })
    for (const node of graph.nodes)
      layout.setNode(node.id, { width: node.width, height: node.height })
    for (const edge of graph.edges) layout.setEdge(edge.source, edge.target)
    dagre.layout(layout)
    for (const node of graph.nodes) {
      positions.set(node.id, {
        x: (node.data.layerIndex - 1) * COLUMN_SPACING,
        y: Math.round(layout.node(node.id).y - node.height! / 2)
      })
    }
    // Dagre ranks and semantic columns can differ for chains of unequal depth.
    const columns = new Map<number, TopologyNode[]>()
    for (const node of graph.nodes) {
      const column = columns.get(node.data.layerIndex) || []
      column.push(node)
      columns.set(node.data.layerIndex, column)
    }
    for (const column of columns.values()) {
      column.sort((a, b) => positions.get(a.id)!.y - positions.get(b.id)!.y)
      let bottom = -Infinity
      for (const node of column) {
        const position = positions.get(node.id)!
        position.y = Math.max(position.y, bottom)
        bottom = position.y + node.height! + NODE_GAP
      }
    }
  }
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = positions.get(node.id)
      if (position)
        return {
          ...node,
          position,
          measured: previousNodes.get(node.id)?.measured ?? node.measured
        }
      const y = bottomByLayer.get(node.data.layerIndex) || 0
      bottomByLayer.set(node.data.layerIndex, y + node.height! + NODE_GAP)
      return { ...node, position: { x: (node.data.layerIndex - 1) * COLUMN_SPACING, y } }
    })
  }
}

export function mergeTopologyGraph(previous: TopologyGraph, next: TopologyGraph): TopologyGraph {
  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]))
  const previousEdges = new Map(previous.edges.map((edge) => [edge.id, edge]))
  return {
    ...next,
    nodes: next.nodes.map((node) => {
      const old = previousNodes.get(node.id)
      if (!old) return node
      const left = old.data
      const right = node.data
      const same =
        left.name === right.name &&
        left.detail === right.detail &&
        left.iconUrl === right.iconUrl &&
        left.uploadSpeed === right.uploadSpeed &&
        left.downloadSpeed === right.downloadSpeed &&
        left.count === right.count &&
        left.policyGroups.length === right.policyGroups.length &&
        left.policyGroups.every((group, index) => group === right.policyGroups[index])
      return same ? old : { ...old, data: right }
    }),
    edges: next.edges.map((edge) => {
      const old = previousEdges.get(edge.id)
      return old &&
        old.data?.weight === edge.data?.weight &&
        old.data?.upload === edge.data?.upload &&
        old.data?.download === edge.data?.download
        ? old
        : edge
    })
  }
}
