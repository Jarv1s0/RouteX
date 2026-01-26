import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useConnections } from '@renderer/hooks/use-connections'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody, Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody, Select, SelectItem } from '@heroui/react'
import { Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, BarChart, Legend, ComposedChart, CartesianGrid } from 'recharts'
import { calcTraffic } from '@renderer/utils/calc'
import { getTrafficStats, clearTrafficStats, getProviderStats, clearProviderStats, triggerProviderSnapshot, getProfileConfig, getProcessTrafficRanking, getAppUptime, testDNSLatency, testConnectivity } from '@renderer/utils/ipc'
import { IoArrowUp, IoArrowDown, IoTrendingUp, IoCalendar, IoRefresh, IoClose, IoFilter, IoTime, IoServer, IoSwapHorizontal, IoTimer, IoGlobe } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import ConfirmModal from '@renderer/components/base/base-confirm'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface TrafficDataPoint {
  time: string
  upload: number
  download: number
}

interface ProcessTrafficItem {
  process: string
  host: string
  upload: number
  download: number
}

const MAX_DATA_POINTS = 60

// Y轴显示整数的流量格式化
const calcTrafficInt = (byte: number): string => {
  if (byte < 1024) return `${Math.round(byte)} B`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} KB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} MB`
  byte /= 1024
  if (byte < 1024) return `${Math.round(byte)} GB`
  byte /= 1024
  return `${Math.round(byte)} TB`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`
        ${CARD_STYLES.GLASS_CARD}
        !border-default-200/50
        px-3 py-2 rounded-xl shadow-xl backdrop-blur-md
      `}>
        <p className="text-xs font-semibold mb-1 text-foreground-500">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-foreground-500">{entry.name}:</span>
            <span className="font-mono font-medium" style={{ color: entry.color || entry.fill }}>
              {entry.name.includes('速度') 
                ? `${calcTraffic(entry.value as number)}/s` 
                : calcTraffic(entry.value as number)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const Stats: React.FC = () => {
  // Hook 注入


  const [trafficHistory, setTrafficHistory] = useState<TrafficDataPoint[]>([])
  const [historyTab, setHistoryTab] = useState<'realtime' | 'hourly' | 'daily' | 'monthly'>('realtime')
  const [hourlyData, setHourlyData] = useState<{ hour: string; upload: number; download: number }[]>([])
  const [dailyData, setDailyData] = useState<{ date: string; upload: number; download: number }[]>([])
  const [sessionStats, setSessionStats] = useState({ upload: 0, download: 0 })
  const [providerData, setProviderData] = useState<{ date: string; provider: string; used: number }[]>([])
  const [currentProviders, setCurrentProviders] = useState<string[]>([])


  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })




  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    return localStorage.getItem('stats-selected-provider') || 'all'
  })
  
  // 清除统计数据状态
  const [clearingStats, setClearingStats] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  // 规则效率统计
  const [ruleStats, setRuleStats] = useState<Map<string, { hits: number; upload: number; download: number }>>(new Map())
  const [processedConnIds, setProcessedConnIds] = useState<Set<string>>(new Set())
  
  // 规则命中详情
  const [ruleHitDetails, setRuleHitDetails] = useState<Map<string, Array<{
    id: string
    time: string
    host: string
    process: string
    proxy: string
    upload: number
    download: number
  }>>>(new Map())
  const [selectedRule, setSelectedRule] = useState<string | null>(null)

  // 进程流量排行弹窗
  const [processTrafficModal, setProcessTrafficModal] = useState<{
    type: 'session' | 'today'
    sortBy: 'upload' | 'download'
    title: string
  } | null>(null)
  const [processTrafficData, setProcessTrafficData] = useState<ProcessTrafficItem[]>([])

  // 清除统计数据
  const handleClearStats = useCallback(async () => {
    setClearingStats(true)
    try {
      await clearTrafficStats()
      await clearProviderStats()
      window.location.reload()
    } catch (e) {
      alert('清除失败: ' + e)
    } finally {
      setClearingStats(false)
      setShowClearConfirm(false)
    }
  }, [])

  // 打开进程流量排行弹窗
  const handleOpenProcessTraffic = useCallback(async (type: 'session' | 'today', sortBy: 'upload' | 'download') => {
    const titles: Record<string, string> = {
      'session-upload': '本次上传 Top10',
      'session-download': '本次下载 Top10',
      'today-upload': '今日上传 Top10',
      'today-download': '今日下载 Top10'
    }
    setProcessTrafficModal({ type, sortBy, title: titles[`${type}-${sortBy}`] })
    try {
      const data = await getProcessTrafficRanking(type, sortBy)
      setProcessTrafficData(data)
    } catch {
      setProcessTrafficData([])
    }
  }, [])

  useEffect(() => {
    const handleTraffic = (_e: unknown, traffic: { up: number; down: number }): void => {
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

      setTrafficHistory(prev => {
        const newPoint: TrafficDataPoint = {
          time: timeStr,
          upload: traffic.up,
          download: traffic.down
        }
        const updated = [...prev, newPoint]
        return updated.slice(-MAX_DATA_POINTS)
      })
    }

    window.electron.ipcRenderer.on('mihomoTraffic', handleTraffic)
    return () => {
      window.electron.ipcRenderer.removeListener('mihomoTraffic', handleTraffic)
    }
  }, [])

  // System Status State
  const [uptime, setUptime] = useState<string>('00:00:00')
  const [dnsLatency, setDnsLatency] = useState<number>(-1)
  const [networkLatency, setNetworkLatency] = useState<number>(-1)
  
  const { connectionCount, memory } = useConnections()
  const memoryUsage = useMemo(() => calcTraffic(memory), [memory])

  useEffect(() => {
    let startTime: number | null = null
    
    // Initial fetch
    getAppUptime().then(seconds => {
      startTime = Date.now() - (seconds * 1000)
    }).catch(() => {
      startTime = Date.now()
    })

    const updateStats = async () => {
      // DNS Latency
      try {
        const latency = await testDNSLatency('www.bing.com')
        setDnsLatency(latency)
      } catch {
        setDnsLatency(-1)
      }

      // Network Latency
      try {
        const res = await testConnectivity('http://www.gstatic.com/generate_204', 2000)
        setNetworkLatency(res.latency)
      } catch {
        setNetworkLatency(-1)
      }
    }

    const interval = setInterval(() => {
      // Uptime Logic
      if (startTime) {
        const now = Date.now()
        const diff = Math.floor((now - startTime) / 1000)
        const days = Math.floor(diff / 86400)
        const hours = Math.floor((diff % 86400) / 3600)
        const minutes = Math.floor((diff % 3600) / 60)
        const secs = diff % 60
        let timeStr = ''
        if (days > 0) timeStr += `${days}天 `
        timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        setUptime(timeStr)
      }
    }, 1000)

    const pollInterval = setInterval(updateStats, 3000) // Poll every 3 seconds for other stats
    updateStats()

    return () => {
      clearInterval(interval)
      clearInterval(pollInterval)
    }
  }, [])


  useEffect(() => {
    // 窗口可见性状态
    const isWindowFocusedRef = { current: !document.hidden }

    const handleVisibilityChange = (): void => {
      isWindowFocusedRef.current = !document.hidden
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const loadStats = async (): Promise<void> => {
      // 窗口不可见时跳过轮询
      if (!isWindowFocusedRef.current) return

      try {
        const stats = await getTrafficStats()
        setHourlyData((stats.hourly || []).slice(-24))
        setDailyData((stats.daily || []).slice(-30))
        setSessionStats({ upload: stats.sessionUpload, download: stats.sessionDownload })

        // 加载订阅统计
        const pStats = await getProviderStats()
        setProviderData(pStats.snapshots || [])

        // 获取当前订阅列表（从 Profile 配置）
        const profileConfig = await getProfileConfig()
        const providers = (profileConfig.items || [])
          .filter(item => item.extra) // 只显示有流量信息的订阅
          .map(item => item.name || item.id)
        setCurrentProviders(providers)
      } catch {
        // ignore
      }
    }
    loadStats()
    const interval = setInterval(loadStats, 15000)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

    // 使用 Ref 存储已处理的连接 ID，避免触发重渲染
    const processedConnIdsRef = React.useRef<Set<string>>(new Set())

    const handleConnections = useCallback((_e: unknown, data: { connections?: Array<{
      id: string
      rule: string
      rulePayload?: string
      upload: number
      download: number
      chains: string[]
      metadata: {
        host?: string
        process?: string
        destinationIP?: string
      }
    }> }): void => {
      const connections = data.connections || []
      let statsChanged = false
      const now = new Date()
      // 这里的 timeStr 可能在渲染周期内不变，但为了 accurately reflecting connection time, keeping it here is fine.
      // 但注意 useCallback 依赖空数组，所以 handleConnections 不会重建，这意味着 timeStr 在函数闭包内是"动态"生成的（每次调用执行），这是正确的。
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

      setRuleStats(prev => {
        const newStats = new Map(prev)
        let hasChanges = false

        connections.forEach(conn => {
          if (!conn.rule) return
          
          const ruleName = conn.rulePayload 
            ? `${conn.rule},${conn.rulePayload}` 
            : conn.rule
          
          let existing = newStats.get(ruleName)
          if (!existing) {
            existing = { hits: 0, upload: 0, download: 0 }
            newStats.set(ruleName, existing)
            hasChanges = true
          }
          
          // 检查是否是新连接
          if (!processedConnIdsRef.current.has(conn.id)) {
            existing.hits += 1
            processedConnIdsRef.current.add(conn.id)
            hasChanges = true
            
            // 更新详情
             setRuleHitDetails(prevDetails => {
              const newDetails = new Map(prevDetails)
              const ruleDetails = newDetails.get(ruleName) || []
              
              ruleDetails.unshift({
                id: conn.id,
                time: timeStr,
                host: conn.metadata?.host || conn.metadata?.destinationIP || '-',
                process: conn.metadata?.process || '-',
                proxy: conn.chains?.length ? conn.chains[0] : 'DIRECT',
                upload: conn.upload,
                download: conn.download
              })
              
              if (ruleDetails.length > 100) {
                 newDetails.set(ruleName, ruleDetails.slice(0, 100))
              } else {
                 newDetails.set(ruleName, ruleDetails)
              }
              return newDetails
            })
          }
          
          if (conn.upload > existing.upload || conn.download > existing.download) {
             existing.upload = Math.max(existing.upload, conn.upload)
             existing.download = Math.max(existing.download, conn.download)
             hasChanges = true
          }
        })
        
        return hasChanges ? newStats : prev
      })
      
      if (processedConnIdsRef.current.size > 50000) {
           processedConnIdsRef.current.clear()
      }
    }, [])

    useEffect(() => {
      window.electron.ipcRenderer.on('mihomoConnections', handleConnections)
      return () => {
        window.electron.ipcRenderer.removeListener('mihomoConnections', handleConnections)
      }
    }, [handleConnections])

  const currentUploadSpeed = trafficHistory.length > 0 ? trafficHistory[trafficHistory.length - 1].upload : 0
  const currentDownloadSpeed = trafficHistory.length > 0 ? trafficHistory[trafficHistory.length - 1].download : 0

  // 使用本地时间生成日期 key，与后端保持一致
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayStats = dailyData.find(d => d.date === today) || { upload: 0, download: 0 }

  const formatHourLabel = (hour: string): string => {
    const parts = hour.split('-')
    return parts.length >= 4 ? `${parts[3]}:00` : hour
  }

  const formatDateLabel = (date: string): string => {
    const parts = date.split('-')
    return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : date
  }

  const formattedHourlyData = useMemo(() => {
    return (hourlyData || []).map(item => ({
      ...item,
      label: formatHourLabel(item.hour)
    }))
  }, [hourlyData])

  const formattedDailyData = useMemo(() => {
    return (dailyData || []).slice(-7).map(item => ({
      ...item,
      label: formatDateLabel(item.date)
    }))
  }, [dailyData])

  const formattedMonthlyData = useMemo(() => {
    return (dailyData || []).map(item => ({
      ...item,
      label: formatDateLabel(item.date)
    }))
  }, [dailyData])

  // 计算总流量（7天）
  const totalUpload7d = (dailyData || []).slice(-7).reduce((sum, d) => sum + d.upload, 0)
  const totalDownload7d = (dailyData || []).slice(-7).reduce((sum, d) => sum + d.download, 0)
  
  // 计算总流量（30天）
  const totalUpload = (dailyData || []).reduce((sum, d) => sum + d.upload, 0)
  const totalDownload = (dailyData || []).reduce((sum, d) => sum + d.download, 0)

  // 订阅统计数据处理 - 计算每日增量
  const providerChartData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    
    // 生成当月所有日期
    const dates: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    
    // 获取要显示的订阅列表
    const providersToShow = selectedProvider === 'all' 
      ? Array.from(new Set(providerData.map(item => item.provider)))
      : [selectedProvider]
    
    // 按日期计算每日增量
    return dates.map(date => {
      const dayData: Record<string, string | number> = { date: date.split('-')[2] + '日' }
      
      providersToShow.forEach(provider => {
        // 获取当天的快照
        const todaySnapshot = providerData.find(d => d.date === date && d.provider === provider)
        
        // 找前一天 - 使用本地时间计算
        const [y, m, d] = date.split('-').map(Number)
        const prevDateObj = new Date(y, m - 1, d - 1) // 月份是0-indexed
        const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevDateObj.getDate()).padStart(2, '0')}`
        // 跨月时也能正确找到上个月的数据（providerData 包含所有月份的数据）
        const prevSnapshot = providerData.find(d => d.date === prevDateStr && d.provider === provider)
        
        // 计算增量
        let daily = 0
        if (todaySnapshot && prevSnapshot) {
          // 有昨日数据，计算增量
          daily = Math.max(0, todaySnapshot.used - prevSnapshot.used)
        }
        // 如果没有昨日数据，增量为0（而不是显示累计值）
        
        dayData[provider] = daily
      })
      return dayData
    })
  }, [providerData, selectedMonth, selectedProvider])

  // 获取所有订阅名称（用于下拉菜单）- 使用当前 Profile 中的订阅列表
  const providerList = useMemo(() => {
    // 优先使用从 Profile 获取的当前订阅列表
    if (currentProviders.length > 0) {
      return currentProviders
    }
    // 如果还没加载到，则从历史数据中提取（兼容）
    const providers = new Set<string>()
    providerData.forEach(item => {
      providers.add(item.provider)
    })
    return Array.from(providers)
  }, [currentProviders, providerData])

  // 当前显示的订阅列表（用于图表）- 反转顺序使堆叠顺序与下拉菜单一致
  const displayProviderList = useMemo(() => {
    if (selectedProvider === 'all') return [...providerList].reverse()
    return [selectedProvider]
  }, [selectedProvider, providerList])

  // 当月总流量（当前选中订阅的增量之和）
  const providerTotalTraffic = useMemo(() => {
    let total = 0
    providerChartData.forEach(day => {
      displayProviderList.forEach(provider => {
        total += (day[provider] as number) || 0
      })
    })
    return total
  }, [providerChartData, displayProviderList])

  // 可选月份列表 - 只显示有数据的月份
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    // 从数据中提取有记录的月份
    providerData.forEach(item => {
      const [year, month] = item.date.split('-')
      months.add(`${year}-${month}`)
    })
    // 如果没有数据，至少显示当前月
    if (months.size === 0) {
      const now = new Date()
      months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(months).sort().reverse()
  }, [providerData])

  // 规则效率排行（按命中次数排序）
  const ruleRanking = useMemo(() => {
    const entries = Array.from(ruleStats.entries())
    const totalHits = entries.reduce((sum, [, stat]) => sum + stat.hits, 0)
    const totalTraffic = entries.reduce((sum, [, stat]) => sum + stat.upload + stat.download, 0)
    
    return entries
      .map(([rule, stat]) => {
        // 获取该规则最后使用的代理节点
        const details = ruleHitDetails.get(rule) || []
        const lastProxy = details.length > 0 ? details[0].proxy : ''
        
        return {
          rule,
          hits: stat.hits,
          traffic: stat.upload + stat.download,
          hitPercent: totalHits > 0 ? Math.round((stat.hits / totalHits) * 100) : 0,
          trafficPercent: totalTraffic > 0 ? Math.round(((stat.upload + stat.download) / totalTraffic) * 100) : 0,
          proxy: lastProxy
        }
      })
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10) // 只显示前10
  }, [ruleStats, ruleHitDetails])

  return (
    <BasePage 
      title="统计"
      header={
        <Button
          size="sm"
          variant="light"
          color="danger"
          isIconOnly
          title="清除统计数据"
          isLoading={clearingStats}
          onPress={() => setShowClearConfirm(true)}
          className="app-nodrag"
        >
          <CgTrash className="text-lg" />
        </Button>
      }
    >
      {showClearConfirm && (
        <ConfirmModal
          onChange={setShowClearConfirm}
          title="确认清除统计数据？"
          description="此操作将清除所有流量统计数据，此操作不可恢复。"
          confirmText="确认清除"
          cancelText="取消"
          onConfirm={handleClearStats}
        />
      )}
      <div className="p-2 space-y-2">


        {/* System Status Card (Full Width) */}
        <Card className={`w-full ${CARD_STYLES.GLASS_CARD}`}>
          <CardBody className="p-4 grid grid-cols-5 gap-4 divide-x divide-default-200/50">
            {/* Uptime */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-2 text-default-500 mb-1">
                <IoTime className="text-lg" />
                <span className="text-sm font-medium">运行时间</span>
              </div>
              <span className="text-xl font-bold text-foreground bg-gradient-to-r from-orange-400 to-pink-600 bg-clip-text text-transparent">
                {uptime || '00:00:00'}
              </span>
            </div>

            {/* Connections */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-2 text-default-500 mb-1">
                <IoSwapHorizontal className="text-lg" />
                <span className="text-sm font-medium">连接数</span>
              </div>
              <span className="text-xl font-bold text-cyan-500">
                {connectionCount ?? 0}
              </span>
            </div>

            {/* Memory */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-2 text-default-500 mb-1">
                <IoServer className="text-lg" />
                <span className="text-sm font-medium">内存占用</span>
              </div>
              <span className="text-xl font-bold text-pink-500">
                {memoryUsage || '0 B'}
              </span>
            </div>

            {/* Network Latency */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-2 text-default-500 mb-1">
                <IoGlobe className="text-lg" />
                <span className="text-sm font-medium">网络延迟</span>
              </div>
              <span className={`text-xl font-bold ${
                (networkLatency ?? -1) === -1 ? 'text-default-400' : 
                networkLatency === 0 ? 'text-danger' : 
                networkLatency < 200 ? 'text-success' : 
                networkLatency < 500 ? 'text-warning' : 'text-danger'
              }`}>
                {(networkLatency ?? -1) === -1 ? '--' : networkLatency === 0 ? 'TIMEOUT' : `${networkLatency}ms`}
              </span>
            </div>

            {/* DNS Latency */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-2 text-default-500 mb-1">
                <IoTimer className="text-lg" />
                <span className="text-sm font-medium">DNS 延迟</span>
              </div>
              <span className={`text-xl font-bold ${
                (dnsLatency ?? -1) < 0 ? 'text-danger' :
                dnsLatency < 50 ? 'text-success' : 
                dnsLatency < 100 ? 'text-warning' : 'text-danger'
              }`}>
                {(dnsLatency ?? -1) >= 0 ? (dnsLatency === 0 ? '<1ms' : `${dnsLatency}ms`) : 'TIMEOUT'}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* 流量统计 - 分组卡片 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 本次流量 */}
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <IoTrendingUp className="text-lg text-foreground-400" />
                <span className="text-sm font-medium">本次流量</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                  onClick={() => handleOpenProcessTraffic('session', 'upload')}
                >
                  <div className="flex items-center gap-1.5">
                    <IoArrowUp className="text-cyan-500" />
                    <span className="text-xl font-bold text-cyan-500">{calcTraffic(sessionStats.upload)}</span>
                  </div>
                </div>
                <div 
                  className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                  onClick={() => handleOpenProcessTraffic('session', 'download')}
                >
                  <div className="flex items-center gap-1.5">
                    <IoArrowDown className="text-purple-500" />
                    <span className="text-xl font-bold text-purple-500">{calcTraffic(sessionStats.download)}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 今日流量 */}
          <Card>
            <CardBody className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <IoCalendar className="text-lg text-foreground-400" />
                <span className="text-sm font-medium">今日流量</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                  onClick={() => handleOpenProcessTraffic('today', 'upload')}
                >
                  <div className="flex items-center gap-1.5">
                    <IoArrowUp className="text-cyan-500" />
                    <span className="text-xl font-bold text-cyan-500">{calcTraffic(todayStats.upload)}</span>
                  </div>
                </div>
                <div 
                  className="cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                  onClick={() => handleOpenProcessTraffic('today', 'download')}
                >
                  <div className="flex items-center gap-1.5">
                    <IoArrowDown className="text-purple-500" />
                    <span className="text-xl font-bold text-purple-500">{calcTraffic(todayStats.download)}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 图表区域 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <Tabs 
                  classNames={CARD_STYLES.GLASS_TABS} 
                  selectedKey={historyTab} 
                  onSelectionChange={(key) => setHistoryTab(key as 'realtime' | 'hourly' | 'daily' | 'monthly')}
                >
                  <Tab key="realtime" title="实时" />
                  <Tab key="hourly" title="24小时" />
                  <Tab key="daily" title="7天" />
                  <Tab key="monthly" title="30天" />
                </Tabs>
              </div>
              {historyTab === 'realtime' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <IoArrowUp className="text-cyan-500 text-sm" />
                    <span className="text-cyan-500 font-bold">{calcTraffic(currentUploadSpeed)}/s</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IoArrowDown className="text-purple-500 text-sm" />
                    <span className="text-purple-500 font-bold">{calcTraffic(currentDownloadSpeed)}/s</span>
                  </div>
                </div>
              )}
              {historyTab === 'daily' && (
                <div className="text-xs text-foreground-400">
                  总计: <span className="text-cyan-500">↑{calcTraffic(totalUpload7d)}</span>
                  {' / '}
                  <span className="text-purple-500">↓{calcTraffic(totalDownload7d)}</span>
                </div>
              )}
              {historyTab === 'monthly' && (
                <div className="text-xs text-foreground-400">
                  总计: <span className="text-cyan-500">↑{calcTraffic(totalUpload)}</span>
                  {' / '}
                  <span className="text-purple-500">↓{calcTraffic(totalDownload)}</span>
                </div>
              )}
            </div>

            <div className="h-[200px] w-full">
              {/* 图表区域 */}
              {historyTab === 'realtime' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trafficHistory} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="currentColor" 
                          className="text-default-200/50" 
                          vertical={false} 
                        />
                        <XAxis 
                          dataKey="time" 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          axisLine={false}
                          tickLine={false}
                          interval={Math.max(Math.floor(trafficHistory.length / 4), 12)}
                          tickFormatter={(value) => {
                            if (typeof value === 'string' && value.length >= 5) {
                              return value.substring(0, 5)
                            }
                            return value
                          }}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          tickFormatter={(v) => calcTrafficInt(v)} 
                          width={55}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeOpacity: 0.2, strokeDasharray: '5 5' }} />
                        <Area 
                          type="monotone" 
                          dataKey="upload" 
                          name="上传速度" 
                          stroke="#06b6d4" 
                          strokeWidth={2} 
                          fill="url(#uploadGradient)"
                          isAnimationActive={true}
                          animationDuration={500}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="download" 
                          name="下载速度" 
                          stroke="#a855f7" 
                          strokeWidth={2} 
                          fill="url(#downloadGradient)"
                          isAnimationActive={true}
                          animationDuration={500}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : historyTab === 'hourly' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedHourlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="currentColor" 
                          className="text-default-200/50" 
                          vertical={false} 
                        />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }}
                          axisLine={false}
                          tickLine={false}
                          interval={2}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          tickFormatter={(v) => calcTrafficInt(v)} 
                          width={55}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-default-100/50' }} />
                        <Legend 
                          verticalAlign="top" 
                          height={30}
                          wrapperStyle={{ fontSize: '12px' }}
                          formatter={(value) => <span className="text-default-500">{value}</span>}
                        />
                        <Bar 
                          dataKey="upload" 
                          name="上传" 
                          fill="#06b6d4" 
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true} 
                          animationDuration={800}
                        />
                        <Bar 
                          dataKey="download" 
                          name="下载" 
                          fill="#a855f7" 
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true} 
                          animationDuration={800}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : historyTab === 'daily' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedDailyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="currentColor" 
                          className="text-default-200/50" 
                          vertical={false} 
                        />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          tickFormatter={(v) => calcTrafficInt(v)} 
                          width={55}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-default-100/50' }} />
                        <Legend 
                          verticalAlign="top" 
                          height={30}
                          wrapperStyle={{ fontSize: '12px' }}
                          formatter={(value) => <span className="text-default-500">{value}</span>}
                        />
                        <Bar 
                          dataKey="upload" 
                          name="上传" 
                          fill="#06b6d4" 
                          radius={[4, 4, 0, 0]} 
                          isAnimationActive={true} 
                          animationDuration={800}
                        />
                        <Bar 
                          dataKey="download" 
                          name="下载" 
                          fill="#a855f7" 
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true} 
                          animationDuration={800} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : historyTab === 'monthly' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedMonthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="currentColor" 
                          className="text-default-200/50" 
                          vertical={false} 
                        />
                        <XAxis 
                          dataKey="label" 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          axisLine={false}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                          tickFormatter={(v) => calcTrafficInt(v)} 
                          width={55}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-default-100/50' }} />
                        <Legend 
                          verticalAlign="top" 
                          height={30}
                          wrapperStyle={{ fontSize: '12px' }}
                          formatter={(value) => <span className="text-default-500">{value}</span>}
                        />
                        <Bar 
                          dataKey="upload" 
                          name="上传" 
                          fill="#06b6d4" 
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true} 
                          animationDuration={800} 
                        />
                        <Bar 
                          dataKey="download" 
                          name="下载" 
                          fill="#a855f7" 
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={true} 
                          animationDuration={800}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : null
                }
            </div>
          </CardBody>
        </Card>

        {/* 订阅统计 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-primary/80" />
                  <span className="text-base font-bold text-foreground">订阅数据</span>
                </div>
                {/* 玻璃拟态工具栏 */}
                <div className={`${CARD_STYLES.GLASS_TOOLBAR} px-1.5 py-1.5 rounded-2xl gap-2`}>
                  <div className="flex items-center gap-2 px-3 py-1 bg-default-100/50 rounded-xl border border-default-200/50 shadow-sm backdrop-blur-sm">
                    <span className="text-xs text-foreground-500">本月使用</span>
                    <span className="text-xs font-bold font-mono text-primary/80">
                      {calcTraffic(providerTotalTraffic)}
                    </span>
                  </div>
                  <Select 
                    size="sm"
                    className="w-[140px]"
                    classNames={CARD_STYLES.GLASS_SELECT}
                    popoverProps={{
                      classNames: {
                        content: CARD_STYLES.GLASS_SELECT.popoverContent
                      }
                    }}
                    startContent={<IoFilter className="text-default-400" />}
                    selectedKeys={[selectedProvider]}
                    onChange={(e) => {
                      setSelectedProvider(e.target.value)
                      localStorage.setItem('stats-selected-provider', e.target.value)
                    }}
                    aria-label="选择订阅"
                    renderValue={(items) => items.map(item => (
                      <span key={item.key} className="text-xs font-medium text-foreground-600">
                        {item.textValue}
                      </span>
                    ))}
                  >
                    {['all', ...providerList].map(p => (
                      <SelectItem key={p} textValue={p === 'all' ? '全部订阅' : p} classNames={{ title: "text-xs" }}>
                        {p === 'all' ? '全部订阅' : p}
                      </SelectItem>
                    ))}
                  </Select>
                  
                  <div className="w-px h-4 bg-default-200/50 mx-1" />

                  <Select 
                    size="sm"
                    className="w-[110px]"
                    classNames={CARD_STYLES.GLASS_SELECT}
                     popoverProps={{
                      classNames: {
                        content: CARD_STYLES.GLASS_SELECT.popoverContent
                      }
                    }}
                    startContent={<IoCalendar className="text-default-400" />}
                    selectedKeys={selectedMonth ? [selectedMonth] : []}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedMonth(e.target.value)
                      }
                    }}
                     renderValue={(items) => items.map(item => (
                      <span key={item.key} className="text-xs font-medium text-foreground-600">
                        {item.textValue}
                      </span>
                    ))}
                    aria-label="选择月份"
                  >
                    {availableMonths.map(m => (
                      <SelectItem key={m} textValue={m.replace('-', '.')} classNames={{ title: "text-xs" }}>
                        {m.replace('-', '.')}
                      </SelectItem>
                    ))}
                  </Select>

                  <Button
                    size="sm"
                    isIconOnly
                    className="bg-default-100/50 hover:bg-default-200/50 text-foreground-500 rounded-xl min-w-8 w-8 h-8 data-[hover=true]:opacity-100"
                    onPress={async () => {
                      try {
                        const pStats = await triggerProviderSnapshot()
                        setProviderData(pStats.snapshots || [])
                        const profileConfig = await getProfileConfig()
                        const providers = (profileConfig.items || [])
                          .filter(item => item.extra)
                          .map(item => item.name || item.id)
                        setCurrentProviders(providers)
                      } catch (e) {
                        // 刷新失败，静默处理
                      }
                    }}
                  >
                    <IoRefresh className="text-sm" />
                  </Button>
                </div>
              </div>


            </div>
            <div className="h-[200px]">
              {providerList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-foreground-400 gap-2">
                  <div className="text-4xl opacity-30">📊</div>
                  <div className="text-sm">暂无订阅统计数据</div>
                  <div className="text-xs text-foreground-500">订阅流量数据将在每日自动记录</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerChartData} margin={{ top: 10, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="currentColor" 
                      className="text-default-200/50" 
                      vertical={false} 
                    />
                    <XAxis 
                      dataKey="date"
                      tick={{ fontSize: 9, fill: 'currentColor', className: 'text-default-400' }} 
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: 'currentColor', className: 'text-default-400' }} 
                      tickFormatter={(v) => calcTrafficInt(v)}
                      width={45}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-default-100/50' }} />
                    {displayProviderList.map((provider) => {
                      // 根据订阅在完整列表中的索引确定颜色
                      const colorIndex = providerList.indexOf(provider)
                      const colors = ['#006FEE', '#f5a524', '#17c964', '#f31260', '#7828c8', '#0072f5']
                      return (
                        <Bar 
                          key={provider} 
                          dataKey={provider}
                          name={provider}
                          stackId={selectedProvider === 'all' ? 'a' : undefined}
                          fill={colors[colorIndex >= 0 ? colorIndex % colors.length : 0]}
                          radius={[4, 4, 0, 0]} 
                        />
                      )
                    })}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>

        {/* 规则效率统计 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-primary/80" />
                <span className="text-base font-bold text-foreground">规则命中统计</span>
              </div>
              <span className="text-xs text-foreground-400">
                共 {ruleStats.size} 条规则命中
              </span>
            </div>
            <div className="space-y-2">
              {ruleRanking.length === 0 ? (
                <div className="h-[120px] flex flex-col items-center justify-center text-foreground-400 gap-2">
                  <div className="text-4xl opacity-30">📋</div>
                  <div className="text-sm">暂无规则命中数据</div>
                  <div className="text-xs text-foreground-500">连接产生后将自动统计规则命中情况</div>
                </div>
              ) : (
                ruleRanking.map((item, index) => {
                  // 渐变色：从主色到透明
                  const barColors = [
                    'from-blue-500 to-blue-500/0',
                    'from-violet-500 to-violet-500/0', 
                    'from-emerald-500 to-emerald-500/0',
                    'from-amber-500 to-amber-500/0',
                    'from-rose-500 to-rose-500/0',
                    'from-cyan-500 to-cyan-500/0',
                    'from-indigo-500 to-indigo-500/0',
                    'from-pink-500 to-pink-500/0',
                    'from-teal-500 to-teal-500/0',
                    'from-orange-500 to-orange-500/0'
                  ]
                  const barColor = barColors[index % barColors.length]
                  
                  return (
                    <div 
                      key={item.rule}
                      className="group relative cursor-pointer"
                      onClick={() => setSelectedRule(item.rule)}
                    >
                      {/* 渐变进度条背景 */}
                      <div 
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} opacity-20 group-hover:opacity-30 transition-opacity rounded-lg pointer-events-none`}
                        style={{ width: `${Math.max(item.hitPercent, 5)}%` }}
                      />
                      {/* 内容 */}
                      <div className="relative flex items-center gap-3 px-3 py-2.5">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          index < 3 
                            ? 'bg-foreground text-background' 
                            : 'bg-default-100 text-foreground-500'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" title={item.rule}>
                            {item.rule.includes(',') ? (
                              <>
                                <span className="text-foreground-400">{item.rule.split(',')[0]}, </span>
                                <span className="text-foreground">{item.rule.split(',').slice(1).join(',')}</span>
                              </>
                            ) : (
                              <span>{item.rule}</span>
                            )}
                            {item.proxy && (
                              <span className="text-violet-500 ml-2">→ {item.proxy}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">{item.hits.toLocaleString()}</span>
                          <span className="text-xs text-foreground-400 w-16 text-right">{calcTraffic(item.traffic)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardBody>
        </Card>

        {/* 规则命中详情弹窗 */}
        <Modal 
          isOpen={!!selectedRule} 
          onClose={() => setSelectedRule(null)} 
          size="2xl" 
          backdrop="blur"
          hideCloseButton
          classNames={{
            backdrop: "top-[48px]"
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex justify-between items-start pr-4">
                  <div className="flex flex-col gap-1">
                    <span>规则命中详情</span>
                    <span className="text-xs font-normal text-foreground-400">{selectedRule}</span>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => setSelectedRule(null)}
                  >
                    <IoClose className="text-lg" />
                  </Button>
                </ModalHeader>
                <ModalBody className="pb-6">
                  {selectedRule && (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {(ruleHitDetails.get(selectedRule) || []).length === 0 ? (
                        <div className="text-center text-foreground-400 py-8">
                          暂无命中记录
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-6 gap-2 text-xs text-foreground-500 font-medium pb-2 border-b border-divider">
                            <span>时间</span>
                            <span className="col-span-2">主机</span>
                            <span>进程</span>
                            <span>代理</span>
                            <span className="text-right">流量</span>
                          </div>
                          {(ruleHitDetails.get(selectedRule) || []).map((detail, index) => (
                            <div key={detail.id + index} className="grid grid-cols-6 gap-2 text-xs py-1.5 border-b border-divider/50">
                              <span className="text-foreground-400">{detail.time}</span>
                              <span className="col-span-2 truncate" title={detail.host}>{detail.host}</span>
                              <span className="truncate text-foreground-500" title={detail.process}>{detail.process}</span>
                              <span className="truncate text-foreground-500" title={detail.proxy}>{detail.proxy}</span>
                              <span className="text-right text-foreground-400">
                                {calcTraffic(detail.upload + detail.download)}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </ModalBody>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* 进程流量排行弹窗 */}
        <Modal 
          isOpen={!!processTrafficModal} 
          onClose={() => setProcessTrafficModal(null)} 
          size="2xl" 
          backdrop="blur"
          hideCloseButton
          classNames={{
            backdrop: "top-[48px]"
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex justify-between items-start pr-4">
                  <div className="flex flex-col gap-1">
                    <span>{processTrafficModal?.title}</span>
                    <span className="text-xs font-normal text-foreground-400">按{processTrafficModal?.sortBy === 'upload' ? '上传' : '下载'}流量排序</span>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => setProcessTrafficModal(null)}
                  >
                    <IoClose className="text-lg" />
                  </Button>
                </ModalHeader>
                <ModalBody className="pb-6">
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {processTrafficData.length === 0 ? (
                      <div className="text-center text-foreground-400 py-8">
                        暂无进程流量数据
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-6 gap-2 text-xs text-foreground-500 font-medium pb-2 border-b border-divider">
                          <span>排名</span>
                          <span>进程</span>
                          <span className="col-span-3">目标域名</span>
                          <span className="text-right">流量</span>
                        </div>
                        {processTrafficData.map((item, index) => (
                          <div key={item.process} className="grid grid-cols-6 gap-2 text-xs py-1.5 border-b border-divider/50">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-warning text-warning-foreground' :
                              index === 1 ? 'bg-default-300 text-default-foreground' :
                              index === 2 ? 'bg-warning-200 text-warning-800' :
                              'bg-default-100 text-default-500'
                            }`}>
                              {index + 1}
                            </span>
                            <span className="truncate" title={item.process}>{item.process}</span>
                            <span className="col-span-3 truncate text-foreground-400" title={item.host}>{item.host || '-'}</span>
                            <span className="text-right">
                              <span className={processTrafficModal?.sortBy === 'upload' ? 'text-cyan-500' : 'text-purple-500'}>
                                {calcTraffic(processTrafficModal?.sortBy === 'upload' ? item.upload : item.download)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </ModalBody>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    </BasePage>
  )
}

export default Stats
