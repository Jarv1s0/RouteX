import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { useConnections } from '@renderer/hooks/use-connections'
import { mihomoProxies } from '@renderer/utils/ipc'
import { useTheme } from 'next-themes'
import { Button } from '@heroui/react'
import { IoRefresh } from 'react-icons/io5'

interface ProxyNode {
    name: string
    type: string
    vehicleType?: string // Optional
    now?: string
    all?: string[]
    alive?: boolean
    history?: { delay: number }[]
    tfo?: boolean
    udp?: boolean
    xudp?: boolean
}

// Sankey Node & Link Interfaces
interface SankeyNode {
    name: string
    itemStyle?: { color?: string; borderColor?: string; borderWidth?: number }
    depth?: number // Optional manual depth control
}



const TopologyMap: React.FC = () => {
    const { connections } = useConnections()
    const [proxies, setProxies] = useState<Record<string, ProxyNode>>({})
    const [manualRefreshTrigger, setManualRefreshTrigger] = useState(0)
    const chartRef = useRef<ReactECharts>(null)
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    // Fetch Proxy Metadata
    const fetchProxies = async () => {
        try {
            const data = await mihomoProxies()
            setProxies(data.proxies as unknown as Record<string, ProxyNode>)
        } catch (e) {
            console.error("Failed to fetch proxies for topology", e)
        }
    }

    useEffect(() => {
        fetchProxies()
    }, [manualRefreshTrigger])

    // Construct Sankey Data
    const sankeyData = useMemo(() => {
        if (!connections || connections.length === 0) return { nodes: [], links: [] }

        const nodesMap = new Map<string, SankeyNode>()
        const linksMap = new Map<string, number>() // key: "source|target", value: count

        // Helper to add node with unique ID per layer
        const addNode = (layerIndex: number, originalName: string) => {
            const uniqueName = `${originalName}__L${layerIndex}` // unique suffix
            if (!nodesMap.has(uniqueName)) {
                // Optimized Flat Color Palette (Modern & Clean)
                let color = '#9ca3af'
                if (layerIndex === 0) color = '#6366f1' // Indigo-500
                else if (layerIndex === 1) color = '#3b82f6' // Blue-500
                else if (layerIndex === 2) color = '#10b981' // Emerald-500
                else if (layerIndex === 3) color = '#f59e0b' // Amber-500
                else if (layerIndex >= 4) color = '#ec4899' // Pink-500

                // Special colors
                if (originalName === 'DIRECT') color = '#06b6d4' // Cyan-500
                if (originalName === 'REJECT') color = '#ef4444' // Red-500
                if (originalName === 'MATCH') color = '#8b5cf6' // Violet-500

                nodesMap.set(uniqueName, {
                    name: uniqueName,
                    itemStyle: { 
                        color, 
                        borderColor: 'transparent',
                        borderWidth: 0
                        // No shadows for flat design
                    }
                })
            }
            return uniqueName
        }

        // Helper to add link
        const addLink = (source: string, target: string) => {
            if (source === target) return
            const key = `${source}|${target}`
            linksMap.set(key, (linksMap.get(key) || 0) + 1)
        }

        connections.forEach(conn => {
            // Layer 0: IP
            const sourceIP = conn.metadata.sourceIP
            const l0 = addNode(0, sourceIP)

            // Layer 1: Process
            let processName = 'Unknown'
            if (conn.metadata.process) {
                const parts = conn.metadata.process.replace(/\\/g, '/').split('/')
                processName = parts[parts.length - 1]
            }
            const l1 = addNode(1, processName)
            addLink(l0, l1)

            // Layer 2: Rule
            // User prefers concise labels: "rulesetAI" instead of "RuleSet: rulesetAI"
            let ruleLabel = conn.rulePayload ? conn.rulePayload : conn.rule
            // Fallback for empty payload (e.g. Match)
            if (!ruleLabel) ruleLabel = 'Match'
            
            // Truncate if too long
            if (ruleLabel.length > 25) ruleLabel = ruleLabel.substring(0, 23) + '...'
            const l2 = addNode(2, ruleLabel)
            addLink(l1, l2)

            // Layer 3+ (Group -> ... -> Node)
            const chain = conn.chains
            
            let normalizedChain: string[] = []
            
            if (!chain || chain.length === 0) {
                 normalizedChain = ['DIRECT', 'DIRECT']
            } else {
                 // **CRITICAL FIX**: Reverse the chain to ensure it flows from Entry Group -> Final Node
                 // API likely returns [FinalNode, Parent, GrandParent...]. We want [GrandParent, Parent, FinalNode].
                 normalizedChain = [...chain].reverse()
                 
                 // If chain is too short (e.g. just 1 item), duplicate it for visual spacing if needed
                 if (normalizedChain.length === 1) {
                     normalizedChain = [normalizedChain[0], normalizedChain[0]]
                 }
            }

            let prevNode = l2
            
            normalizedChain.forEach((item, index) => {
                 // Layer index starts at 3
                 const currentLayer = 3 + index
                 const node = addNode(currentLayer, item)
                 
                 addLink(prevNode, node)
                 prevNode = node
            })
        })

        // Convert Maps to Arrays
        const nodes = Array.from(nodesMap.values())
        const links = Array.from(linksMap.entries()).map(([key, value]) => {
            const [source, target] = key.split('|')
            return {
                source,
                target,
                value
            }
        })

        return { nodes, links }
    }, [connections, proxies, isDark])

    const getOption = useCallback(() => {
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                triggerOn: 'mousemove',
                backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: isDark ? '#444' : '#e5e7eb',
                borderWidth: 1,
                padding: [8, 12],
                textStyle: {
                    color: isDark ? '#f3f4f6' : '#1f2937',
                    fontSize: 12
                },
                formatter: (params: { dataType: string; name: string; value: number; data: { source: string; target: string } }) => {
                    if (params.dataType === 'node') {
                         const name = params.name.includes('__') ? params.name.split('__')[0] : params.name
                         return `<div class="font-medium">${name}</div><div class="text-xs opacity-75 mt-1">Connections: ${params.value}</div>`
                    }
                    if (params.dataType === 'edge') {
                        const s = params.data.source.split('__')[0]
                        const t = params.data.target.split('__')[0]
                        return `<div class="text-xs opacity-75">${s} <span class="mx-1">→</span> ${t}</div><div class="font-medium mt-1">${params.value} connections</div>`
                    }
                    return ''
                }
            },
            series: [
                {
                    type: 'sankey',
                    data: sankeyData.nodes,
                    links: sankeyData.links,
                    emphasis: {
                        focus: 'adjacency'
                    },
                    nodeAlign: 'left', // Align nodes to left to form layers strictly? 'justify' spreads them.
                    layoutIterations: 64, // Optimization level
                    nodeWidth: 20, // Slightly wider for better presence
                    nodeGap: 16,   // More breathing room
                    lineStyle: {
                        color: 'gradient',
                        curveness: 0.5,
                        opacity: 0.35 // Subtle transparency
                    },
                    label: {
                        color: isDark ? '#e5e5e5' : '#374151',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 12,
                        fontWeight: 500,
                        formatter: (params: { name: string }) => {
                            if (typeof params.name === 'string' && params.name.includes('__')) {
                                return params.name.split('__')[0]
                            }
                            return params.name
                        }
                    },
                    // Levels config to force consistent colors/positions if needed, 
                    // but we set itemStyle per node.
                    top: '5%',
                    bottom: '5%',
                    left: '2%',
                    right: '15%'
                }
            ]
        }
    }, [sankeyData, isDark])

    return (
        <div className="h-full w-full relative">
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button 
                    isIconOnly 
                    size="sm" 
                    variant="flat" 
                    className="opacity-50 hover:opacity-100 transition-opacity bg-transparent"
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
            ) : sankeyData.nodes.length === 0 ? (
                 <div className="flex justify-center items-center h-full text-default-400 text-sm">
                    解析数据结构中...
                </div>
            ) : (
                <ReactECharts
                    ref={chartRef}
                    option={getOption()}
                    style={{ height: '100%', width: '100%' }}
                    className="react-echarts-container"
                    notMerge={false} 
                    lazyUpdate={true}
                    theme={isDark ? 'dark' : undefined}
                />
            )}
        </div>
    )
}

export default TopologyMap
