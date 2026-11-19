import { describe, expect, it } from 'vitest'
import {
  buildTopologyGraph,
  filterTopologyConnections,
  layoutTopologyGraph,
  mergeTopologyGraph
} from './graph'

function connection(
  overrides: Partial<ControllerConnectionDetail> = {}
): ControllerConnectionDetail {
  return {
    id: 'a',
    metadata: {
      process: 'browser.exe',
      processPath: 'C:\\Apps\\browser.exe',
      host: 'docs.example.org'
    },
    chains: ['HK node', 'Proxy'],
    rule: 'DomainSuffix',
    rulePayload: 'example.org',
    uploadSpeed: 1024,
    downloadSpeed: 4096,
    ...overrides
  } as ControllerConnectionDetail
}

describe('topology graph', () => {
  it('aggregates both traffic directions at every stage and counts connections once', () => {
    const graph = buildTopologyGraph([
      connection(),
      connection({ id: 'b', uploadSpeed: 512, downloadSpeed: 2048 })
    ])
    expect(graph.connectionCount).toBe(2)
    expect(graph.uploadSpeed).toBe(1536)
    expect(graph.downloadSpeed).toBe(6144)
    expect(graph.nodes.map((node) => node.type)).toEqual(['source', 'rule', 'chain', 'exit'])
    for (const node of graph.nodes) {
      expect(node.data).toMatchObject({ uploadSpeed: 1536, downloadSpeed: 6144, count: 2 })
    }
    for (const edge of graph.edges)
      expect(edge.data).toEqual({ weight: 2, upload: 1536, download: 6144 })
  })

  it('renders direct and short chains as real exits alongside longer chains without duplicating DIRECT', () => {
    const graph = buildTopologyGraph([
      connection({ chains: ['DIRECT'] }),
      connection({ id: 'b', chains: ['HK node', 'HK group', 'Proxy'] })
    ])
    const exits = graph.nodes.filter((node) => node.type === 'exit')
    expect(exits.map((node) => node.data.name).sort()).toEqual(['DIRECT', 'HK node'])
    expect(new Set(exits.map((node) => node.data.layerIndex)).size).toBe(1)
    expect(graph.nodes.filter((node) => node.data.name === 'DIRECT')).toHaveLength(1)
    expect(
      buildTopologyGraph([connection({ chains: [] })]).nodes.filter((node) => node.type === 'exit')
    ).toHaveLength(1)
  })

  it('keeps full rule identities, rule types and process paths distinct', () => {
    const prefix = 'this-is-a-very-long-common-domain-prefix.'
    const first = connection({ rulePayload: prefix + 'one.example' })
    const second = connection({
      id: 'b',
      rulePayload: prefix + 'two.example',
      metadata: { ...first.metadata, processPath: 'D:\\Apps\\browser.exe' }
    })
    const third = connection({ id: 'c', rulePayload: first.rulePayload, rule: 'RuleSet' })
    const graph = buildTopologyGraph([first, second, third])
    expect(graph.nodes.filter((node) => node.type === 'source')).toHaveLength(2)
    expect(graph.nodes.filter((node) => node.type === 'rule')).toHaveLength(3)
    expect(graph.nodes.some((node) => node.data.name === prefix + 'one.example')).toBe(true)
  })

  it('preserves every edge with delimiter-heavy names and shared nodes', () => {
    const graph = buildTopologyGraph([
      connection({ chains: ['c', 'a-b'] }),
      connection({ id: 'b', chains: ['b-c', 'a'] }),
      connection({ id: 'c', chains: ['x__L3,[]"', 'a-b'] })
    ])
    expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(graph.nodes.length)
    expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(graph.edges.length)
    expect([...graph.nodes, ...graph.edges].every((item) => !/["\\]/.test(item.id))).toBe(true)
    expect(
      graph.edges.filter(
        (edge) => graph.nodes.find((node) => node.id === edge.target)?.type === 'exit'
      )
    ).toHaveLength(3)
  })

  it('uses the same structure for reordered connections and speed-only updates', () => {
    const first = connection()
    const second = connection({ id: 'b', chains: ['DIRECT'] })
    const original = buildTopologyGraph([first, second])
    expect(buildTopologyGraph([second, { ...first, uploadSpeed: 0 }]).structureKey).toBe(
      original.structureKey
    )
  })

  it('keeps semantic columns free of overlap for mixed chain depths', () => {
    const graph = layoutTopologyGraph(
      buildTopologyGraph(
        Array.from({ length: 8 }, (_, index) =>
          connection({
            id: String(index),
            chains: [
              `exit-${index}`,
              ...Array.from({ length: index % 4 }, (_, level) => `group-${index}-${level}`)
            ]
          })
        )
      )
    )
    for (const layer of new Set(graph.nodes.map((node) => node.data.layerIndex))) {
      const column = graph.nodes
        .filter((node) => node.data.layerIndex === layer)
        .sort((a, b) => a.position.y - b.position.y)
      for (let index = 1; index < column.length; index++) {
        expect(column[index].position.y).toBeGreaterThanOrEqual(
          column[index - 1].position.y + column[index - 1].height! + 20
        )
      }
    }
  })

  it('retains positions when nodes arrive or disappear and does not overlap new nodes', () => {
    const original = layoutTopologyGraph(buildTopologyGraph([connection()]))
    const second = connection({
      id: 'b',
      metadata: { ...connection().metadata, process: 'other.exe', processPath: 'D:\\other.exe' }
    })
    const expanded = layoutTopologyGraph(buildTopologyGraph([connection(), second]), original)
    for (const node of original.nodes)
      expect(expanded.nodes.find((next) => next.id === node.id)?.position).toEqual(node.position)
    const sources = expanded.nodes
      .filter((node) => node.type === 'source')
      .sort((a, b) => a.position.y - b.position.y)
    expect(sources[1].position.y).toBeGreaterThanOrEqual(sources[0].position.y + sources[0].height!)
    const contracted = layoutTopologyGraph(buildTopologyGraph([second]), expanded)
    for (const node of contracted.nodes)
      expect(node.position).toEqual(
        expanded.nodes.find((previous) => previous.id === node.id)?.position
      )
  })

  it('reuses unaffected nodes and edges while updating changed traffic without moving them', () => {
    const first = connection()
    const second = connection({
      id: 'b',
      metadata: { ...first.metadata, processPath: 'D:\\other.exe' },
      chains: ['DIRECT']
    })
    const original = layoutTopologyGraph(buildTopologyGraph([first, second]))
    const merged = mergeTopologyGraph(
      original,
      buildTopologyGraph([{ ...first, uploadSpeed: 9000 }, second])
    )
    const direct = original.nodes.find((node) => node.data.name === 'DIRECT')!
    expect(merged.nodes.find((node) => node.id === direct.id)).toBe(direct)
    const process = original.nodes.find(
      (node) => node.type === 'source' && node.data.detail === first.metadata.processPath
    )!
    const updated = merged.nodes.find((node) => node.id === process.id)!
    expect(updated.data.uploadSpeed).toBe(9000)
    expect(updated.position).toBe(process.position)
    expect(merged.edges.some((edge) => original.edges.includes(edge))).toBe(true)
  })

  it('filters complete connection paths without losing the associated stages', () => {
    const first = connection()
    const second = connection({
      id: 'b',
      rulePayload: 'other.test',
      chains: ['DIRECT'],
      metadata: {
        ...first.metadata,
        process: 'other.exe',
        processPath: 'D:\\Other.exe',
        host: 'other.test'
      }
    })
    for (const query of ['BROWSER', 'c:\\apps', 'docs.example', 'DomainSuffix', 'HK node']) {
      const filtered = filterTopologyConnections([first, second], query)
      expect(filtered).toContain(first)
      expect(buildTopologyGraph(filtered).nodes.some((node) => node.type === 'exit')).toBe(true)
    }
    expect(filterTopologyConnections([first, second], 'missing')).toEqual([])
    const all = [first, second]
    expect(filterTopologyConnections(all, '  ')).toBe(all)
  })
})
