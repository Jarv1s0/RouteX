import React, { useEffect, useState, useRef } from 'react'
import {
    ReactFlow,
    Background,
    Controls,
    Node,
    Edge,
    useReactFlow,
    ReactFlowProvider
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { useConnections } from '@renderer/hooks/use-connections'
import { mihomoProxies } from '@renderer/utils/ipc'
import { useTheme } from 'next-themes'
import { Button } from '@heroui/react'
import { IoRefresh } from 'react-icons/io5'

import { nodeTypes } from './connections/topology/CustomNodes'
import { edgeTypes } from './connections/topology/AnimatedEdge'

// Put this component inside ReactFlowProvider to control layout auto-fitting
const LayoutHelper = ({ nodesCount }: { nodesCount: number }) => {
    const { fitView } = useReactFlow()
    const initialFitDone = useRef(false)
    
    // Auto-fit on window resize
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>
        const handleResize = () => {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                fitView({ padding: 0.1, duration: 0 })
            }, 50)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [fitView])

    useEffect(() => {
        if (nodesCount > 0 && !initialFitDone.current) {
            setTimeout(() => {
                // Instant fit without duration to prevent the card switch "jumping" animation
                fitView({ padding: 0.1, duration: 0 })
            }, 30)
            initialFitDone.current = true
        }
    }, [nodesCount, fitView])

    return null
}

// dagre layout function
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    // Set graph config
    // Adjust nodesep and ranksep for better spacing
    // Since rankdir is 'LR', 'nodesep' controls the vertical Y spacing between nodes.
    // Explicitly set align to 'UL' (Up-Left) to anchor Y to top, preventing vertical shifts when nodes are added
    dagreGraph.setGraph({ rankdir: direction, nodesep: 15, ranksep: 360, align: 'UL' })

    nodes.forEach((node) => {
        // Generate precise static bounds for dagre layout matching the CustomNodes exactly
        let width = 180
        let height = 56 // Base component height
        if (node.type === 'source') { width = 240; height = 80; }
        if (node.type === 'exit') { width = 230; height = 90; }
        if (node.type === 'rule' || node.type === 'chain') { width = 180; height = 56; }
        
        dagreGraph.setNode(node.id, { width, height })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    // Override X positions to strict columns based on layer index
    const columnSpacing = 450 // generous spacing for wide cards and edge paths

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        
        // Ensure perfect vertical columns:
        // `layerIndex` starts at 1. We hardcode X based on layerIndex to force strict columns.
        const layerIdx = (node.data.layerIndex as number) || 1
        const targetX = (layerIdx - 1) * columnSpacing

        return {
            ...node,
            position: {
                x: targetX,
                // Use Math.round to prevent sub-pixel rendering and potential ResizeObserver loops
                y: Math.round(nodeWithPosition.y - nodeWithPosition.height / 2),
            },
            draggable: false, 
            selectable: false, // Ensure selection outlines don't modify bounding boxes
        }
    })

    return { nodes: newNodes, edges }
}

const TopologyMapInner = () => {
    const { connections } = useConnections()
    const [proxies, setProxies] = useState<Record<string, any>>({})
    const [manualRefreshTrigger, setManualRefreshTrigger] = useState(0)
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])

    const fetchProxies = async () => {
        try {
            const data = await mihomoProxies()
            setProxies(data.proxies as any)
        } catch (e) {
            console.error("Failed to fetch proxies for topology", e)
        }
    }

    useEffect(() => {
        fetchProxies()
    }, [manualRefreshTrigger])

    // Construct React Flow Data
    useEffect(() => {
        if (!connections || connections.length === 0) {
            setNodes([])
            setEdges([])
            return
        }

        const nodesMap = new Map<string, any>()
        const linksMap = new Map<string, { weight: number, download: number, upload: number }>()

        // Maps to aggregate traffic per node
        const nodeTraffic = new Map<string, { download: number, upload: number, count: number }>()

        // Helper to add node
        const addNode = (layerIndex: number, originalName: string, iconUrl?: string, displayIcon?: boolean, policyGroup?: string) => {
            const uniqueName = `${originalName}__L${layerIndex}`
            if (!nodesMap.has(uniqueName)) {
                let type = 'chain'
                if (layerIndex === 1) type = 'source' // We skip layer 0 (IP) for cleaner UI like the card
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
                nodesMap.get(uniqueName).data.policyGroups.add(policyGroup)
            }
            return uniqueName
        }

        // Helper to add link
        const addLink = (source: string, target: string, upload: number, download: number) => {
            if (source === target) return
            const key = `${source}|${target}`
            // Prevent self loops
            if (!linksMap.has(key)) {
                linksMap.set(key, { weight: 0, download: 0, upload: 0 })
            }
            const cur = linksMap.get(key)!
            cur.weight += 1
            cur.download += download
            cur.upload += upload
            
            const srcTraffic = nodeTraffic.get(source)
            if (srcTraffic) {
                srcTraffic.upload += upload
                srcTraffic.count += 1
            }
            // For target, only increment count once per connection traversal
        }
        
        // Secondary pass for target counts to avoid double counting on branches
        const targetCounter = new Map<string, number>()

        let maxLayerIndex = 0

        connections.forEach(conn => {
            const uploadSpeed = conn.uploadSpeed || 0
            const downloadSpeed = conn.downloadSpeed || 0
            
            // Layer 1: Process
            let processName = 'Unknown'
            let iconUrl = ''
            let displayIcon = false
            
            if (conn.metadata.process) {
                const parts = conn.metadata.process.replace(/\\/g, '/').split('/')
                processName = parts[parts.length - 1]
                iconUrl = conn.metadata.processPath ? `http://127.0.0.1:3333/api/icon?path=${encodeURIComponent(conn.metadata.processPath)}` : ''
                displayIcon = !!iconUrl
            }
            
            const l1 = addNode(1, processName, iconUrl, displayIcon)

            // Layer 2: Rule
            let ruleLabel = conn.rulePayload ? conn.rulePayload : conn.rule
            if (!ruleLabel) ruleLabel = 'Match'
            if (ruleLabel.length > 25) ruleLabel = ruleLabel.substring(0, 23) + '...'
            const l2 = addNode(2, ruleLabel)
            
            addLink(l1, l2, uploadSpeed, downloadSpeed)
            targetCounter.set(l2, (targetCounter.get(l2) || 0) + 1)
            const tgtTraffic2 = nodeTraffic.get(l2); if (tgtTraffic2) tgtTraffic2.download += downloadSpeed;

            // Layer 3+
            const chain = conn.chains
            let normalizedChain: string[] = []
            
            if (!chain || chain.length === 0) {
                 normalizedChain = ['DIRECT', 'DIRECT']
            } else {
                 normalizedChain = [...chain].reverse()
                 // Deduplicate adjacent identical nodes to avoid self-loops visually
                 normalizedChain = normalizedChain.filter((item, idx) => idx === 0 || item !== normalizedChain[idx - 1])
                 if (normalizedChain.length === 1) {
                     normalizedChain = [normalizedChain[0], normalizedChain[0]]
                 }
            }

            let prevNode = l2
            
            const rootPolicyGroup = normalizedChain.length > 0 ? normalizedChain[0] : undefined

            normalizedChain.forEach((item, index) => {
                 const currentLayer = 3 + index
                 if (currentLayer > maxLayerIndex) maxLayerIndex = currentLayer
                 const node = addNode(currentLayer, item, undefined, undefined, rootPolicyGroup)
                 
                 addLink(prevNode, node, uploadSpeed, downloadSpeed)
                 targetCounter.set(node, (targetCounter.get(node) || 0) + 1)
                 const tgtTraffic = nodeTraffic.get(node); if (tgtTraffic) tgtTraffic.download += downloadSpeed;
                 
                 prevNode = node
            })
        })

        // Format nodes array
        const initialNodes: Node[] = []
        nodesMap.forEach((node, id) => {
            const traffic = nodeTraffic.get(id)
            node.data.uploadSpeed = traffic?.upload || 0
            node.data.downloadSpeed = traffic?.download || 0
            // count logic: source count is source traffic count. Target count is from targetCounter
            node.data.count = node.data.layerIndex === 1 ? (traffic?.count || 0) : (targetCounter.get(id) || 0)
            
            // Adjust type if it's the rightmost layer
            if (node.data.layerIndex === maxLayerIndex && maxLayerIndex > 0) {
                node.type = 'exit'
            }
            initialNodes.push(node)
        })
        
        // Sort initial nodes to ensure DIRECT and REJECT are consistently placed if rank is the same
        initialNodes.sort((a, b) => {
             const aName = a.data.name as string
             const bName = b.data.name as string
             if (aName === 'DIRECT' && bName !== 'DIRECT') return -1
             if (bName === 'DIRECT' && aName !== 'DIRECT') return 1
             if (aName === 'REJECT' && bName !== 'REJECT') return -1
             if (bName === 'REJECT' && aName !== 'REJECT') return 1
             
             // Sort alphabetically to ensure Dagre layout is 100% deterministic and doesn't swap cards vertically during traffic refresh ticks
             return aName.localeCompare(bName)
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

        // Apply Dagre layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges)
        
        // Preserve consistent state, allowing ReactFlow to re-render data.
        // Update to `lnode.position` ensures we respect Dagre's top-anchored layout.
        setNodes((nds) => {
            return layoutedNodes.map(lnode => {
                const existingNode = nds.find(n => n.id === lnode.id)
                if (existingNode) {
                    // Update data and position, preventing coordinate lock from causing overlaps
                    return { ...existingNode, data: lnode.data, type: lnode.type, position: lnode.position }
                }
                return lnode
            })
        })
        setEdges(layoutedEdges)

    }, [connections, proxies, setEdges, setNodes]) 
    // Intentionally omit setNodes, setEdges inner deps handling if stable, to manage layout nicely

    return (
        <div className="h-full w-full relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button 
                    isIconOnly 
                    size="sm" 
                    variant="flat" 
                    className="opacity-50 hover:opacity-100 transition-opacity bg-background dark:bg-default-100 backdrop-blur-md border border-default-200"
                    onPress={() => setManualRefreshTrigger(prev => prev + 1)}
                    title="刷新"
                >
                    <IoRefresh size={18} />
                </Button>
            </div>

            {connections.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full text-default-400 gap-3 opacity-60">
                    <div className="text-4xl grayscale">🕸️</div>
                    <div className="text-sm font-medium">暂无活动连接</div>
                </div>
            ) : nodes.length === 0 ? (
                 <div className="flex justify-center items-center h-full text-default-400 text-sm">
                    解析数据结构中...
                </div>
            ) : (
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    edgeTypes={edgeTypes as any}
                    minZoom={0.05}
                    maxZoom={4}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    nodesFocusable={false}
                    edgesFocusable={false}
                    defaultEdgeOptions={{ type: 'animated', interactionWidth: 0 }}
                    proOptions={{ hideAttribution: true }}
                >
                    <LayoutHelper nodesCount={nodes.length} />
                    <Background color={isDark ? '#444' : '#ccc'} gap={20} size={1} />
                    <Controls showInteractive={false} className="opacity-50 hover:opacity-100 border-none shadow-md overflow-hidden rounded-lg mx-4" />
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
