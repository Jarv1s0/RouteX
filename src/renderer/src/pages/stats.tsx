import React, { useEffect, useMemo, useState, useCallback } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody, Tabs, Tab, Button, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react'
import { Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, BarChart, Legend, ComposedChart, CartesianGrid, Line, LineChart } from 'recharts'
import { calcTraffic } from '@renderer/utils/calc'
import { getTrafficStats, clearTrafficStats, getProviderStats, clearProviderStats, triggerProviderSnapshot, getProfileConfig, getProcessTrafficRanking } from '@renderer/utils/ipc'
import { IoArrowUp, IoArrowDown, IoTrendingUp, IoCalendar, IoRefresh, IoClose } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import ConfirmModal from '@renderer/components/base/base-confirm'

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

const Stats: React.FC = () => {
  const [trafficHistory, setTrafficHistory] = useState<TrafficDataPoint[]>([])
  const [historyTab, setHistoryTab] = useState<'realtime' | 'hourly' | 'daily' | 'monthly'>('realtime')
  const [hourlyData, setHourlyData] = useState<{ hour: string; upload: number; download: number }[]>([])
  const [dailyData, setDailyData] = useState<{ date: string; upload: number; download: number }[]>([])
  const [sessionStats, setSessionStats] = useState({ upload: 0, download: 0 })
  const [providerData, setProviderData] = useState<{ date: string; provider: string; used: number }[]>([])
  const [currentProviders, setCurrentProviders] = useState<string[]>([]) // 当前订阅列表（从 Profile 获取）
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  
  // 网络健康度监控
  const [currentLatency, setCurrentLatency] = useState<number>(-1)
  const [, setCurrentConnections] = useState<number>(0)
  const [, setAvgLatency] = useState<number>(0)
  const [, setMaxLatency] = useState<number>(0)
  const [, setMinLatency] = useState<number>(0)
  const [jitter, setJitter] = useState<number>(0)
  const [, setPacketLoss] = useState<number>(0)
  const [, setLatencyTestCount] = useState<number>(0)
  const [, setLatencyFailCount] = useState<number>(0)
  const [uptime, setUptime] = useState<number>(100)
  const [latencyHistory, setLatencyHistory] = useState<{ time: string; latency: number; jitter: number; color: string; jitterColor: string; success: boolean }[]>([])
  
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

  useEffect(() => {
    const loadStats = async (): Promise<void> => {
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
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  // 网络健康度监控 - 监听主进程发送的数据
  useEffect(() => {
    // 获取初始数据
    window.electron.ipcRenderer.invoke('getNetworkHealthStats').then((stats: {
      currentLatency: number
      avgLatency: number
      maxLatency: number
      minLatency: number
      jitter: number
      packetLoss: number
      uptime: number
      testCount: number
      failCount: number
    }) => {
      if (stats) {
        setCurrentLatency(stats.currentLatency)
        setAvgLatency(stats.avgLatency)
        setMaxLatency(stats.maxLatency)
        setMinLatency(stats.minLatency)
        setJitter(stats.jitter)
        setPacketLoss(stats.packetLoss)
        setUptime(stats.uptime)
        setLatencyTestCount(stats.testCount)
        setLatencyFailCount(stats.failCount)
      }
    }).catch(() => {
      // ignore
    })
    
    // 监听主进程发送的网络健康数据
    const handleNetworkHealth = (_e: unknown, stats: {
      currentLatency: number
      avgLatency: number
      maxLatency: number
      minLatency: number
      jitter: number
      packetLoss: number
      uptime: number
      testCount: number
      failCount: number
    }): void => {
      setCurrentLatency(stats.currentLatency)
      setAvgLatency(stats.avgLatency)
      setMaxLatency(stats.maxLatency)
      setMinLatency(stats.minLatency)
      setJitter(stats.jitter)
      setPacketLoss(stats.packetLoss)
      setUptime(stats.uptime)
      setLatencyTestCount(stats.testCount)
      setLatencyFailCount(stats.failCount)
      
      // 记录延迟历史
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      const latencyValue = stats.currentLatency > 0 ? stats.currentLatency : 0
      const isSuccess = stats.currentLatency > 0
      setLatencyHistory(prev => {
        const newPoint = {
          time: timeStr,
          latency: latencyValue,
          jitter: stats.jitter,
          color: latencyValue <= 0 ? '#f31260' : latencyValue <= 100 ? '#17c964' : latencyValue <= 200 ? '#f5a524' : '#f31260',
          jitterColor: stats.jitter <= 10 ? '#17c964' : stats.jitter <= 30 ? '#f5a524' : '#f31260',
          success: isSuccess
        }
        const updated = [...prev, newPoint]
        return updated.slice(-30) // 保留最近30个点
      })
    }

    window.electron.ipcRenderer.on('networkHealth', handleNetworkHealth)
    return () => {
      window.electron.ipcRenderer.removeListener('networkHealth', handleNetworkHealth)
    }
  }, [])

  // 监听连接数和规则统计
  useEffect(() => {
    const handleConnections = (_e: unknown, data: { connections?: Array<{
      id: string
      rule: string
      rulePayload?: string
      upload: number
      download: number
      metadata: {
        host?: string
        process?: string
        destinationIP?: string
      }
    }> }): void => {
      const connections = data.connections || []
      const count = connections.length
      setCurrentConnections(count)
      
      // 统计规则命中
      setRuleStats(prev => {
        const newStats = new Map(prev)
        
        connections.forEach(conn => {
          if (!conn.rule) return
          
          // 组合规则名称
          const ruleName = conn.rulePayload 
            ? `${conn.rule},${conn.rulePayload}` 
            : conn.rule
          
          const existing = newStats.get(ruleName) || { hits: 0, upload: 0, download: 0 }
          
          // 检查是否是新连接（通过ID判断）
          if (!processedConnIds.has(conn.id)) {
            existing.hits += 1
            setProcessedConnIds(prevIds => new Set([...prevIds, conn.id]))
            
            // 记录命中详情
            setRuleHitDetails(prevDetails => {
              const newDetails = new Map(prevDetails)
              const ruleDetails = newDetails.get(ruleName) || []
              const now = new Date()
              const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
              
              ruleDetails.unshift({
                id: conn.id,
                time: timeStr,
                host: conn.metadata?.host || conn.metadata?.destinationIP || '-',
                process: conn.metadata?.process || '-',
                upload: conn.upload,
                download: conn.download
              })
              
              // 只保留最近100条
              newDetails.set(ruleName, ruleDetails.slice(0, 100))
              return newDetails
            })
          }
          
          // 更新流量（累计）
          existing.upload = Math.max(existing.upload, conn.upload)
          existing.download = Math.max(existing.download, conn.download)
          
          newStats.set(ruleName, existing)
        })
        
        return newStats
      })
    }

    window.electron.ipcRenderer.on('mihomoConnections', handleConnections)
    return () => {
      window.electron.ipcRenderer.removeListener('mihomoConnections', handleConnections)
    }
  }, [processedConnIds])

  const currentUploadSpeed = trafficHistory.length > 0 ? trafficHistory[trafficHistory.length - 1].upload : 0
  const currentDownloadSpeed = trafficHistory.length > 0 ? trafficHistory[trafficHistory.length - 1].download : 0
  const peakUploadSpeed = trafficHistory.length > 0 ? Math.max(...trafficHistory.map(d => d.upload)) : 0
  const peakDownloadSpeed = trafficHistory.length > 0 ? Math.max(...trafficHistory.map(d => d.download)) : 0

  const today = new Date().toISOString().split('T')[0]
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
        // 获取当天和前一天的快照
        const todaySnapshot = providerData.find(d => d.date === date && d.provider === provider)
        
        // 找前一天
        const prevDate = new Date(date)
        prevDate.setDate(prevDate.getDate() - 1)
        const prevDateStr = prevDate.toISOString().split('T')[0]
        const prevSnapshot = providerData.find(d => d.date === prevDateStr && d.provider === provider)
        
        // 计算增量
        let daily = 0
        if (todaySnapshot && prevSnapshot) {
          // 有昨日数据，计算增量
          daily = Math.max(0, todaySnapshot.used - prevSnapshot.used)
        } else if (todaySnapshot && !prevSnapshot) {
          // 首日数据：没有昨日数据时，显示当天的累计值
          daily = todaySnapshot.used
        }
        
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
      .map(([rule, stat]) => ({
        rule,
        hits: stat.hits,
        traffic: stat.upload + stat.download,
        hitPercent: totalHits > 0 ? Math.round((stat.hits / totalHits) * 100) : 0,
        trafficPercent: totalTraffic > 0 ? Math.round(((stat.upload + stat.download) / totalTraffic) * 100) : 0
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10) // 只显示前10
  }, [ruleStats])

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
        {/* 实时速度 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <IoArrowUp className="text-cyan-500 text-xl" />
                </div>
                <div className="flex-1">
                  <div className="text-foreground-500 text-xs">上传速度</div>
                  <div className="text-cyan-500 text-xl font-bold">{calcTraffic(currentUploadSpeed)}/s</div>
                </div>
                <div className="text-right">
                  <div className="text-foreground-400 text-xs">峰值</div>
                  <div className="text-cyan-500/70 text-sm">{calcTraffic(peakUploadSpeed)}/s</div>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <IoArrowDown className="text-purple-500 text-xl" />
                </div>
                <div className="flex-1">
                  <div className="text-foreground-500 text-xs">下载速度</div>
                  <div className="text-purple-500 text-xl font-bold">{calcTraffic(currentDownloadSpeed)}/s</div>
                </div>
                <div className="text-right">
                  <div className="text-foreground-400 text-xs">峰值</div>
                  <div className="text-purple-500/70 text-sm">{calcTraffic(peakDownloadSpeed)}/s</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 流量统计 */}
        <div className="grid grid-cols-4 gap-3">
          <Card isPressable onPress={() => handleOpenProcessTraffic('session', 'upload')} className="cursor-pointer hover:bg-default-100 transition-colors">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoTrendingUp className="text-cyan-500 text-sm" />
                <span className="text-foreground-500 text-xs">本次上传</span>
              </div>
              <div className="text-cyan-500 font-semibold">{calcTraffic(sessionStats.upload)}</div>
            </CardBody>
          </Card>
          <Card isPressable onPress={() => handleOpenProcessTraffic('session', 'download')} className="cursor-pointer hover:bg-default-100 transition-colors">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoTrendingUp className="text-purple-500 text-sm" />
                <span className="text-foreground-500 text-xs">本次下载</span>
              </div>
              <div className="text-purple-500 font-semibold">{calcTraffic(sessionStats.download)}</div>
            </CardBody>
          </Card>
          <Card isPressable onPress={() => handleOpenProcessTraffic('today', 'upload')} className="cursor-pointer hover:bg-default-100 transition-colors">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoCalendar className="text-cyan-500 text-sm" />
                <span className="text-foreground-500 text-xs">今日上传</span>
              </div>
              <div className="text-cyan-500 font-semibold">{calcTraffic(todayStats.upload)}</div>
            </CardBody>
          </Card>
          <Card isPressable onPress={() => handleOpenProcessTraffic('today', 'download')} className="cursor-pointer hover:bg-default-100 transition-colors">
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoCalendar className="text-purple-500 text-sm" />
                <span className="text-foreground-500 text-xs">今日下载</span>
              </div>
              <div className="text-purple-500 font-semibold">{calcTraffic(todayStats.download)}</div>
            </CardBody>
          </Card>
        </div>

        {/* 图表区域 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <Tabs 
                size="sm" 
                selectedKey={historyTab} 
                onSelectionChange={(key) => setHistoryTab(key as 'realtime' | 'hourly' | 'daily' | 'monthly')}
              >
                <Tab key="realtime" title="实时" />
                <Tab key="hourly" title="24小时" />
                <Tab key="daily" title="7天" />
                <Tab key="monthly" title="30天" />
              </Tabs>
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

            <div className="h-[300px]">
              {historyTab === 'realtime' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trafficHistory} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#c084fc" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" strokeOpacity={0.3} vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10, fill: '#888', dy: 8 }} 
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
                      tick={{ fontSize: 10, fill: '#999' }} 
                      tickFormatter={(v) => calcTrafficInt(v)} 
                      width={55}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined, name?: string) => {
                        if (value === undefined) return ['', '']
                        const label = name === '上传' ? '上传速度' : '下载速度'
                        return [`${calcTraffic(value)}/s`, label]
                      }}
                      labelFormatter={(label) => label}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255,255,255,0.95)', 
                        border: '1px solid #e5e5e5', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={30}
                      iconType="circle"
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#666' }}>{value === '上传' ? '上传速度' : '下载速度'}</span>}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="upload" 
                      name="上传" 
                      stroke="#22d3ee" 
                      strokeWidth={1.5} 
                      fill="url(#uploadGradient)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="download" 
                      name="下载" 
                      stroke="#c084fc" 
                      strokeWidth={1.5} 
                      fill="url(#downloadGradient)" 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : historyTab === 'hourly' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedHourlyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      interval={2}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      tickFormatter={(v) => calcTrafficInt(v)} 
                      width={55}
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value !== undefined ? [calcTraffic(value)] : ['']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--heroui-content1))', 
                        border: '1px solid hsl(var(--heroui-default-200))', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={30}
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#888' }}>{value}</span>}
                    />
                    <Bar dataKey="upload" name="上传" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="download" name="下载" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : historyTab === 'daily' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedDailyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      tickFormatter={(v) => calcTrafficInt(v)} 
                      width={55}
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value !== undefined ? [calcTraffic(value)] : ['']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--heroui-content1))', 
                        border: '1px solid hsl(var(--heroui-default-200))', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={30}
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#888' }}>{value}</span>}
                    />
                    <Bar dataKey="upload" name="上传" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="download" name="下载" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : historyTab === 'monthly' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedMonthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      interval={4}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      tickFormatter={(v) => calcTrafficInt(v)} 
                      width={55}
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value !== undefined ? [calcTraffic(value)] : ['']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--heroui-content1))', 
                        border: '1px solid hsl(var(--heroui-default-200))', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={30}
                      formatter={(value) => <span style={{ fontSize: '12px', color: '#888' }}>{value}</span>}
                    />
                    <Bar dataKey="upload" name="上传" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="download" name="下载" fill="#c084fc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* 网络质量趋势 */}
        <Card>
          <CardBody className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-foreground-500">网络质量</span>
                <span className={`text-sm font-bold ${currentLatency < 0 ? 'text-danger' : currentLatency > 200 ? 'text-danger' : currentLatency > 100 ? 'text-warning' : 'text-success'}`}>
                  {currentLatency >= 0 ? `${currentLatency}ms` : '超时'}
                </span>
                <span className="text-xs text-foreground-400">
                  抖动 <span className={jitter > 50 ? 'text-danger' : jitter > 20 ? 'text-warning' : 'text-success'}>{jitter}ms</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-success"></span>
                  <span className="text-foreground-400">&lt;100ms</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-warning"></span>
                  <span className="text-foreground-400">100-200ms</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-danger"></span>
                  <span className="text-foreground-400">&gt;200ms</span>
                </span>
                <span className="text-foreground-300">|</span>
                <span className="text-foreground-400">抖动:</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-success"></span>
                  <span className="text-foreground-400">&lt;10ms</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-warning"></span>
                  <span className="text-foreground-400">10-30ms</span>
                </span>
              </div>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyHistory} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#17c964" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#17c964" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 9, fill: '#888', dy: 8 }} 
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fill: '#888' }} 
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip 
                    formatter={(value: number | undefined, name?: string) => {
                      if (value === undefined) return ['', '']
                      const label = name === 'latency' ? '延迟' : '抖动'
                      return [`${value}ms`, label]
                    }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--heroui-content1))', 
                      border: '1px solid hsl(var(--heroui-default-200))', 
                      borderRadius: '6px', 
                      fontSize: '11px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="#17c964"
                    strokeWidth={2} 
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      if (!cx || !cy) return null
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={2} 
                          fill={payload.color || '#17c964'} 
                          stroke="none"
                        />
                      )
                    }}
                    activeDot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="jitter" 
                    stroke="#7828c8"
                    strokeWidth={2} 
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      if (!cx || !cy) return null
                      return (
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={2} 
                          fill={payload.jitterColor || '#7828c8'} 
                          stroke="none"
                        />
                      )
                    }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* 在线状态条 - 紧凑版 */}
            <div className="mt-2 pt-2 border-t border-default-100">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${uptime >= 99 ? 'bg-success' : uptime >= 95 ? 'bg-warning' : 'bg-danger'} animate-pulse`}></div>
                  <span className="text-xs">
                    {uptime >= 99 ? '运行正常' : uptime >= 95 ? '部分异常' : '服务中断'}
                  </span>
                  <span className={`text-xs font-medium ${uptime >= 99 ? 'text-success' : uptime >= 95 ? 'text-warning' : 'text-danger'}`}>
                    {uptime}%
                  </span>
                </div>
                <span className="text-xs text-foreground-400">
                  最近 {latencyHistory.length} 次 · 每 15s
                </span>
              </div>
              <div className="flex h-2 rounded overflow-hidden bg-default-100 gap-px">
                {latencyHistory.length === 0 ? (
                  <div className="flex-1 bg-default-200 animate-pulse"></div>
                ) : (
                  latencyHistory.map((point, index) => (
                    <div
                      key={index}
                      className="flex-1 transition-all duration-300 hover:opacity-80 cursor-pointer relative group"
                      style={{ 
                        backgroundColor: point.success 
                          ? point.latency <= 100 ? '#17c964' 
                          : point.latency <= 200 ? '#f5a524' 
                          : '#f31260'
                          : '#f31260'
                      }}
                      title={`${point.time} - ${point.success ? `${point.latency}ms` : '超时'}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-content1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-default-200 z-10">
                        {point.time} · {point.success ? `${point.latency}ms` : '超时'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 订阅统计 */}
        <Card>
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium">订阅统计</span>
              <div className="flex items-center gap-2">
                <select 
                  className="text-xs bg-default-100 rounded px-2 py-1"
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  <option value="all">全部订阅</option>
                  {providerList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select 
                  className="text-xs bg-default-100 rounded px-2 py-1"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m.replace('-', '年')}月</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  title="刷新数据"
                  className="text-foreground-400 hover:text-foreground-600"
                  onPress={async () => {
                    try {
                      const pStats = await triggerProviderSnapshot()
                      setProviderData(pStats.snapshots || [])
                      // 同时更新当前订阅列表
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
                <span className="text-xs text-foreground-400">
                  {selectedProvider === 'all' ? '本月总计' : '本月使用'}: <span className="text-primary">{calcTraffic(providerTotalTraffic)}</span>
                </span>
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
                  <BarChart data={providerChartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <XAxis 
                      dataKey="date"
                      tick={{ fontSize: 9, fill: '#888' }} 
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      interval={2}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      tickFormatter={(v) => calcTrafficInt(v)}
                      width={55}
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined, name?: string) => {
                        if (value === undefined) return ['', '']
                        return [calcTraffic(value), name || '']
                      }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--heroui-content1))', 
                        border: '1px solid hsl(var(--heroui-default-200))', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    />
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
              <span className="text-sm font-medium">规则效率排行</span>
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
                ruleRanking.map((item, index) => (
                  <div 
                    key={item.rule} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-default-100 rounded-lg p-1 -m-1 transition-colors"
                    onClick={() => setSelectedRule(item.rule)}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-warning text-warning-foreground' :
                      index === 1 ? 'bg-default-300 text-default-foreground' :
                      index === 2 ? 'bg-warning-200 text-warning-800' :
                      'bg-default-100 text-default-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs truncate" title={item.rule}>
                          {item.rule.length > 40 ? item.rule.substring(0, 40) + '...' : item.rule}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-default-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${item.hitPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-foreground-400 w-8">{item.hitPercent}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium">{item.hits} 次</div>
                      <div className="text-xs text-foreground-400">{calcTraffic(item.traffic)}</div>
                    </div>
                  </div>
                ))
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
                          <div className="grid grid-cols-5 gap-2 text-xs text-foreground-500 font-medium pb-2 border-b border-divider">
                            <span>时间</span>
                            <span className="col-span-2">主机</span>
                            <span>进程</span>
                            <span className="text-right">流量</span>
                          </div>
                          {(ruleHitDetails.get(selectedRule) || []).map((detail, index) => (
                            <div key={detail.id + index} className="grid grid-cols-5 gap-2 text-xs py-1.5 border-b border-divider/50">
                              <span className="text-foreground-400">{detail.time}</span>
                              <span className="col-span-2 truncate" title={detail.host}>{detail.host}</span>
                              <span className="truncate text-foreground-500" title={detail.process}>{detail.process}</span>
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
