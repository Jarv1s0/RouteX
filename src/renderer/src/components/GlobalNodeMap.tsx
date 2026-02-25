import React, { useEffect, useState, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { fetchBatchIpInfo, getCurrentProfileStr, IpInfoResult } from '@renderer/utils/ipc'
import { useTheme } from 'next-themes'
import YAML from 'yaml'

interface ProxyItem {
    name: string
    server: string
    [key: string]: unknown
}

interface GeoNode {
    name: string
    value: [number, number]
    ip?: string
    country?: string
    count?: number
}

const GlobalNodeMap: React.FC = () => {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [nodes, setNodes] = useState<GeoNode[]>([])
    const chartRef = useRef<ReactECharts>(null)
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    const [centerNode, setCenterNode] = useState<{name: string, coord: [number, number]}>({
        name: 'CN', 
        coord: [108.9402, 34.3416] // Default: Xi'an
    })

    useEffect(() => {
        const detectLocation = async () => {
            try {
                // 1. Detect Local Location (Async, Non-blocking)
                const res = await fetch('https://ipapi.co/json/')
                if (res.ok) {
                    const data = await res.json()
                    if (data.latitude && data.longitude) {
                        setCenterNode({
                            name: data.country_code || 'CN',
                            coord: [data.longitude, data.latitude]
                        })
                        return // Success
                    }
                }
                
                // Fallback to ip-api if ipapi.co fails
                const res2 = await fetch('http://ip-api.com/json')
                if (res2.ok) {
                    const data2 = await res2.json()
                    if (data2.lat && data2.lon) {
                        setCenterNode({
                            name: data2.countryCode || 'CN',
                            coord: [data2.lon, data2.lat]
                        })
                    }
                }
            } catch (e) {
                console.warn("Failed to detect local location, using default.", e)
            }
        }

        const initMap = async () => {
            try {
                // Start location detection in background
                detectLocation()

                // Load worldMap dynamically to split chunks and reduce initial bundle size
                const worldMap = (await import('@renderer/assets/world.json')).default
                
                // Register Map Immediately
                echarts.registerMap('world', worldMap as unknown as Parameters<typeof echarts.registerMap>[1])
                
                // Get Raw Profile Config for Server Addresses
                const profileYaml = await getCurrentProfileStr()
                const profile = YAML.parse(profileYaml)
                const proxies = profile.proxies || []

                // Name-based Location Inference (Heuristic)
                // Maps Keywords -> [Longitude, Latitude]
                const COUNTRY_COORDINATES: Record<string, [number, number]> = {
                    'HK': [114.1095, 22.3964], 'HKG': [114.1095, 22.3964], '香港': [114.1095, 22.3964], 'HONG KONG': [114.1095, 22.3964],
                    'TW': [120.9605, 23.6978], 'TWN': [120.9605, 23.6978], '台湾': [120.9605, 23.6978], '台北': [121.5654, 25.0330], 'TAIWAN': [120.9605, 23.6978],
                    'JP': [138.2529, 36.2048], 'JPN': [138.2529, 36.2048], '日本': [138.2529, 36.2048], 'JAPAN': [138.2529, 36.2048],
                    'US': [-95.7129, 37.0902], 'USA': [-95.7129, 37.0902], '美国': [-95.7129, 37.0902], 'AMERICA': [-95.7129, 37.0902], 'UNITED STATES': [-95.7129, 37.0902],
                    'SG': [103.8198, 1.3521], 'SGP': [103.8198, 1.3521], '狮城': [103.8198, 1.3521], 'SINGAPORE': [103.8198, 1.3521],
                    'KR': [127.7669, 35.9078], 'KOR': [127.7669, 35.9078], '韩国': [127.7669, 35.9078], 'KOREA': [127.7669, 35.9078], 'SOUTH KOREA': [127.7669, 35.9078],
                    'GB': [-3.4359, 55.3781], 'UK': [-3.4359, 55.3781], 'GBR': [-3.4359, 55.3781], '英国': [-3.4359, 55.3781], 'UNITED KINGDOM': [-3.4359, 55.3781],
                    'DE': [10.4515, 51.1657], 'DEU': [10.4515, 51.1657], '德国': [10.4515, 51.1657], 'GERMANY': [10.4515, 51.1657],
                    'FR': [2.2137, 46.2276], 'FRA': [2.2137, 46.2276], '法国': [2.2137, 46.2276], 'FRANCE': [2.2137, 46.2276],
                    'CA': [-106.3468, 56.1304], 'CAN': [-106.3468, 56.1304], '加拿大': [-106.3468, 56.1304], 'CANADA': [-106.3468, 56.1304],
                    'AU': [133.7751, -25.2744], 'AUS': [133.7751, -25.2744], '澳洲': [133.7751, -25.2744], '澳大利亚': [133.7751, -25.2744], 'AUSTRALIA': [133.7751, -25.2744],
                    'IN': [78.9629, 20.5937], 'IND': [78.9629, 20.5937], '印度': [78.9629, 20.5937], 'INDIA': [78.9629, 20.5937],
                    'RU': [105.3188, 61.5240], 'RUS': [105.3188, 61.5240], '俄罗斯': [105.3188, 61.5240], 'RUSSIA': [105.3188, 61.5240],
                    'TR': [35.2433, 38.9637], 'TUR': [35.2433, 38.9637], '土耳其': [35.2433, 38.9637], 'TURKEY': [35.2433, 38.9637],
                    'AR': [-63.6167, -38.4161], 'ARG': [-63.6167, -38.4161], '阿根廷': [-63.6167, -38.4161], 'ARGENTINA': [-63.6167, -38.4161],
                    'BR': [-51.9253, -14.2350], 'BRA': [-51.9253, -14.2350], '巴西': [-51.9253, -14.2350], 'BRAZIL': [-51.9253, -14.2350],
                    'NL': [5.2913, 52.1326], 'NLD': [5.2913, 52.1326], '荷兰': [5.2913, 52.1326], 'NETHERLANDS': [5.2913, 52.1326],
                }

                // Helper to get DISPLAY NAME (Abbreviation)
                const getCanonicalName = (keyOrName: string): string => {
                    const upper = keyOrName.toUpperCase()
                    if (['HK', 'HKG', '香港', 'HONG KONG'].some(k => upper === k || upper.includes(k))) return 'HK'
                    if (['TW', 'TWN', '台湾', '台北', 'TAIWAN'].some(k => upper === k || upper.includes(k))) return 'TW'
                    if (['JP', 'JPN', '日本', 'JAPAN'].some(k => upper === k || upper.includes(k))) return 'JP'
                    if (['US', 'USA', '美国', 'AMERICA', 'UNITED STATES'].some(k => upper === k || upper.includes(k))) return 'US'
                    if (['SG', 'SGP', '狮城', 'SINGAPORE'].some(k => upper === k || upper.includes(k))) return 'SG'
                    if (['KR', 'KOR', '韩国', 'KOREA', 'SOUTH KOREA'].some(k => upper === k || upper.includes(k))) return 'KR'
                    if (['GB', 'UK', 'GBR', '英国', 'UNITED KINGDOM'].some(k => upper === k || upper.includes(k))) return 'UK'
                    if (['DE', 'DEU', '德国', 'GERMANY'].some(k => upper === k || upper.includes(k))) return 'DE'
                    if (['FR', 'FRA', '法国', 'FRANCE'].some(k => upper === k || upper.includes(k))) return 'FR'
                    if (['CA', 'CAN', '加拿大', 'CANADA'].some(k => upper === k || upper.includes(k))) return 'CA'
                    if (['AU', 'AUS', '澳洲', '澳大利亚', 'AUSTRALIA'].some(k => upper === k || upper.includes(k))) return 'AU'
                    if (['IN', 'IND', '印度', 'INDIA'].some(k => upper === k || upper.includes(k))) return 'IN'
                    if (['RU', 'RUS', '俄罗斯', 'RUSSIA'].some(k => upper === k || upper.includes(k))) return 'RU'
                    if (['NL', 'NLD', '荷兰', 'NETHERLANDS'].some(k => upper === k || upper.includes(k))) return 'NL'
                    
                    // If it's already a 2-letter code from IP-API (e.g. 'CN', 'VN'), use it
                    if (keyOrName.length === 2) return keyOrName.toUpperCase()

                    // Default fallback: First 3 letters
                    return keyOrName.substring(0, 3).toUpperCase()
                }

                // Helper to extract a Keyword from a Proxy Name
                const findKeywordInName = (name: string): string | null => {
                    const upperName = name.toUpperCase()
                    // Check strict keys first
                    for (const key of Object.keys(COUNTRY_COORDINATES)) {
                        if (upperName.includes(key)) {
                            return key
                        }
                    }
                    return null
                }

                const countryStats = new Map<string, { 
                    name: string, 
                    coord: [number, number], 
                    count: number
                }>()

                const candidatesForQuery: { name: string, query: string }[] = []

                if (Array.isArray(proxies)) {
                    proxies.forEach((proxy: ProxyItem) => {
                         if (!proxy.server || proxy.name === 'GLOBAL') return
                         
                         const matchedKey = findKeywordInName(proxy.name)

                         if (matchedKey) {
                             const canonicalName = getCanonicalName(matchedKey)
                             // Use one of the coordinates for this group (e.g. from the matched key)
                             // We don't jitter here because we want single point
                             const coord = COUNTRY_COORDINATES[matchedKey]

                             if (!countryStats.has(canonicalName)) {
                                 countryStats.set(canonicalName, {
                                     name: canonicalName, 
                                     coord: coord,
                                     count: 0
                                 })
                             }
                             countryStats.get(canonicalName)!.count++
                         } else {
                             candidatesForQuery.push({
                                 name: proxy.name,
                                 query: proxy.server
                             })
                         }
                    })
                }

                // Deduplicate queries for remaining IPs
                const uniqueQueries = [...new Set(candidatesForQuery.map(c => c.query))] as string[]
                
                // Batch Resolve IPs
                if (uniqueQueries.length > 0) {
                     const chunks: string[][] = []
                    for (let i = 0; i < uniqueQueries.length; i += 100) {
                        chunks.push(uniqueQueries.slice(i, i + 100))
                    }

                    for (const chunk of chunks) {
                         try {
                            const queries = chunk.map(q => ({ query: q, fields: "status,message,lat,lon,country,countryCode,query" }))
                            let data: IpInfoResult[] = []
                            try {
                                data = await fetchBatchIpInfo(queries)
                            } catch(e) { console.error(e) }

                            if (Array.isArray(data)) {
                                data.forEach((item: IpInfoResult) => {
                                    if (item.status === 'success') {
                                        // Try to map back to our Canonical Names
                                        const rawCountry = item.country || item.countryCode
                                        const canonicalName = getCanonicalName(rawCountry || "Unknown")
                                        
                                        // Try to find a coordinate for this canonical name if possible
                                        // If we already have this country from keywords, use that coord
                                        // If not, use the IP coord
                                        let coord: [number, number] = [item.lon || 0, item.lat || 0]
                                        
                                        if (countryStats.has(canonicalName)) {
                                            const existing = countryStats.get(canonicalName)!
                                            coord = existing.coord
                                        } else {
                                            // If it matches a known static key, use static coord
                                            if (item.countryCode && COUNTRY_COORDINATES[item.countryCode]) {
                                                 coord = COUNTRY_COORDINATES[item.countryCode]
                                            }
                                        }

                                        if (!countryStats.has(canonicalName)) {
                                            countryStats.set(canonicalName, {
                                                name: canonicalName,
                                                coord: coord,
                                                count: 0
                                            })
                                        }
                                        countryStats.get(canonicalName)!.count++
                                    }
                                })
                            }
                         } catch (e) {
                             console.error("Chunk Error", e)
                         }
                    }
                }

                // Convert Stats to Nodes
                const finalNodes: GeoNode[] = []
                countryStats.forEach((stat) => {
                    finalNodes.push({
                        name: stat.name,
                        value: stat.coord,
                        count: stat.count
                    })
                })

                setNodes(finalNodes)
                setLoading(false)
            } catch (err: unknown) {
                const errMsg = (err as Error).message || "Failed to load map"
                console.error("Failed to load map data", err)
                setError(errMsg)
                setLoading(false)
            }
        }
        initMap()
    }, [])

    const getOption = () => {
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                padding: 0,
                formatter: (params: echarts.DefaultLabelFormatterCallbackParams) => {
                    const name = params.name
                    if (params.seriesType === 'effectScatter') {
                         const data = params.data as GeoNode
                         const count = data.count || 1
                         return `
                            <div class="px-4 py-2 rounded-xl backdrop-blur-md bg-white/70 dark:bg-black/40 border border-white/40 dark:border-white/10 shadow-xl text-foreground">
                                <div class="font-bold text-sm mb-1 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-success"></span>
                                    ${name}
                                </div>
                                <div class="text-xs text-default-500">可用节点: <span class="text-foreground font-mono">${count}</span></div>
                            </div>
                         `
                    }
                    return `
                        <div class="px-3 py-1.5 rounded-lg backdrop-blur-md bg-white/70 dark:bg-black/40 border border-white/40 dark:border-white/10 shadow-lg text-xs text-foreground font-medium">
                            ${name}
                        </div>
                    `
                }
            },
            grid: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 0
            },
            geo: {
                map: 'world',
                roam: true,
                zoom: 1.2,
                label: {
                    emphasis: {
                        show: false
                    }
                },
                itemStyle: {
                    normal: {
                        areaColor: isDark ? '#0f172a' : '#f4f4f5', // 深空蓝 / 灰白
                        borderColor: isDark ? '#1e293b' : '#e4e4e7', // 深色边缘
                        borderWidth: 1,
                    },
                    emphasis: {
                        areaColor: isDark ? '#1e293b' : '#e4e4e7',
                        shadowBlur: 10,
                        shadowColor: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)'
                    }
                }
            },
            series: [
                {
                    type: 'lines',
                    zlevel: 1,
                    effect: {
                        show: true,
                        period: 3, // Slightly faster
                        trailLength: 0.4, // Longer trail for better glow
                        color: '#2dd4bf', // Teal glow for lines
                        symbol: 'arrow',
                        symbolSize: 4
                    },
                    lineStyle: {
                        normal: {
                            color: '#2dd4bf',
                            width: 0.5, 
                            opacity: 0.1, // Slightly more visible
                            curveness: 0.2 // Smoother flatter curve
                        }
                    },
                    data: nodes.map(node => {
                        return {
                            fromName: node.name,
                            toName: centerNode.name,
                            coords: [node.value, centerNode.coord]
                        }
                    })
                },
                {
                    // LOCAL NODE HIGHLIGHT (Actually this is the main proxy nodes series)
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    zlevel: 2,
                    rippleEffect: {
                        brushType: 'stroke',
                        scale: 3
                    },
                    label: {
                       show: true,
                       position: 'right',
                       formatter: (params: echarts.DefaultLabelFormatterCallbackParams) => {
                           return `${params.name}`
                       },
                       fontSize: 10,
                       color: isDark ? '#fff' : '#333'
                    },
                    symbolSize: (_val: unknown, params: echarts.DefaultLabelFormatterCallbackParams) => {
                        const data = params.data as GeoNode
                        const count = data?.count || 1
                        return 6 + Math.log(count) * 4
                    },
                    itemStyle: {
                        color: '#2dd4bf', // Teal for remote nodes
                        shadowBlur: 10,
                        shadowColor: '#2dd4bf'
                    },
                    data: nodes
                },
                {
                    // LOCAL NODE HIGHLIGHT
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    zlevel: 3,
                    rippleEffect: {
                        brushType: 'stroke',
                        scale: 5 // Stronger ripple
                    },
                    symbolSize: 12,
                    itemStyle: {
                        color: '#fb923c', // Warm Orange
                        shadowBlur: 10,
                        shadowColor: '#fb923c'
                    },
                    label: {
                        show: true,
                        position: 'top',
                        formatter: centerNode.name,
                        fontSize: 12,
                        fontWeight: 'bold',
                        color: '#fb923c'
                    },
                    data: [{
                        name: 'Local',
                        value: centerNode.coord,
                        count: 1
                    }]
                }
            ]
        }
    }

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center text-foreground">Loading Map Data...</div>
    }

    if (error) {
        return <div className="flex h-full w-full items-center justify-center text-red-500">Error: {error}</div>
    }

    return (
        <div className="h-full w-full relative">
             <ReactECharts 
                ref={chartRef}
                option={getOption()} 
                opts={{ devicePixelRatio: window.devicePixelRatio * 2 }}
                style={{ height: '100%', width: '100%' }}
                className="react-echarts-container"
             />
             
             {/* Stats Overlay - Bottom Right Classy Card */}
             <div className="absolute bottom-6 right-6 pointer-events-none">
                <div className="flex items-center gap-4 px-6 py-4 rounded-2xl backdrop-blur-lg bg-white/40 dark:bg-black/20 border border-white/40 dark:border-white/10 shadow-2xl">
                    <div className="flex flex-col items-end">
                        <span className="text-default-500 text-xs font-medium tracking-wider mb-1">全球覆盖</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 tracking-tighter">
                                {nodes.length}
                            </span>
                            <span className="text-default-400 text-sm font-medium">个节点</span>
                        </div>
                    </div>
                </div>
             </div>
        </div>
    )
}

export default GlobalNodeMap
