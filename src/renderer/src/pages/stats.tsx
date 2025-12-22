import React, { useEffect, useMemo, useState, useCallback } from 'react'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody, Tabs, Tab, Button } from '@heroui/react'
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, BarChart, Legend } from 'recharts'
import { calcTraffic } from '@renderer/utils/calc'
import { getTrafficStats, clearTrafficStats, getProviderStats, clearProviderStats } from '@renderer/utils/ipc'
import { IoArrowUp, IoArrowDown, IoTrendingUp, IoCalendar } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import ConfirmModal from '@renderer/components/base/base-confirm'

interface TrafficDataPoint {
  time: string
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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  // 清除统计数据状态
  const [clearingStats, setClearingStats] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

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

  useEffect(() => {
    const handleTraffic = (_e: unknown, traffic: { up: number; down: number }): void => {
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

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
      } catch {
        // ignore
      }
    }
    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

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
    
    // 获取所有订阅名称
    const providers = new Set<string>()
    providerData.forEach(item => {
      providers.add(item.provider)
    })
    
    // 按日期计算每日增量
    return dates.map(date => {
      const dayData: Record<string, string | number> = { date: date.split('-')[2] + '日' }
      
      providers.forEach(provider => {
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
          daily = Math.max(0, todaySnapshot.used - prevSnapshot.used)
        } else if (todaySnapshot && !prevSnapshot) {
          // 没有前一天数据，显示0（无法计算增量）
          daily = 0
        }
        
        dayData[provider] = daily
      })
      return dayData
    })
  }, [providerData, selectedMonth])

  // 获取所有订阅名称（用于图表）
  const providerList = useMemo(() => {
    const providers = new Set<string>()
    providerData.forEach(item => {
      providers.add(item.provider)
    })
    return Array.from(providers)
  }, [providerData])

  // 当月总流量（所有订阅的增量之和）
  const providerTotalTraffic = useMemo(() => {
    let total = 0
    providerChartData.forEach(day => {
      providerList.forEach(provider => {
        total += (day[provider] as number) || 0
      })
    })
    return total
  }, [providerChartData, providerList])

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

  return (
    <BasePage 
      title="流量统计"
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
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <IoArrowUp className="text-warning text-xl" />
                </div>
                <div className="flex-1">
                  <div className="text-foreground-500 text-xs">上传速度</div>
                  <div className="text-warning text-xl font-bold">{calcTraffic(currentUploadSpeed)}/s</div>
                </div>
                <div className="text-right">
                  <div className="text-foreground-400 text-xs">峰值</div>
                  <div className="text-warning/70 text-sm">{calcTraffic(peakUploadSpeed)}/s</div>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <IoArrowDown className="text-primary text-xl" />
                </div>
                <div className="flex-1">
                  <div className="text-foreground-500 text-xs">下载速度</div>
                  <div className="text-primary text-xl font-bold">{calcTraffic(currentDownloadSpeed)}/s</div>
                </div>
                <div className="text-right">
                  <div className="text-foreground-400 text-xs">峰值</div>
                  <div className="text-primary/70 text-sm">{calcTraffic(peakDownloadSpeed)}/s</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 流量统计 */}
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoTrendingUp className="text-warning text-sm" />
                <span className="text-foreground-500 text-xs">本次上传</span>
              </div>
              <div className="text-warning font-semibold">{calcTraffic(sessionStats.upload)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoTrendingUp className="text-primary text-sm" />
                <span className="text-foreground-500 text-xs">本次下载</span>
              </div>
              <div className="text-primary font-semibold">{calcTraffic(sessionStats.download)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoCalendar className="text-warning text-sm" />
                <span className="text-foreground-500 text-xs">今日上传</span>
              </div>
              <div className="text-warning font-semibold">{calcTraffic(todayStats.upload)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <IoCalendar className="text-primary text-sm" />
                <span className="text-foreground-500 text-xs">今日下载</span>
              </div>
              <div className="text-primary font-semibold">{calcTraffic(todayStats.download)}</div>
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
                  总计: <span className="text-warning">↑{calcTraffic(totalUpload7d)}</span>
                  {' / '}
                  <span className="text-primary">↓{calcTraffic(totalDownload7d)}</span>
                </div>
              )}
              {historyTab === 'monthly' && (
                <div className="text-xs text-foreground-400">
                  总计: <span className="text-warning">↑{calcTraffic(totalUpload)}</span>
                  {' / '}
                  <span className="text-primary">↓{calcTraffic(totalDownload)}</span>
                </div>
              )}
            </div>

            <div className="h-[300px]">
              {historyTab === 'realtime' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficHistory} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f5a524" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#f5a524" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#006FEE" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#006FEE" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10, fill: '#888' }} 
                      axisLine={{ stroke: '#333' }}
                      tickLine={{ stroke: '#333' }}
                      interval="preserveStartEnd"
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
                      formatter={(value: number | undefined) => value !== undefined ? [`${calcTraffic(value)}/s`] : ['']}
                      labelFormatter={(label) => `${label}`}
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
                    <Area 
                      type="monotone" 
                      dataKey="upload" 
                      name="上传" 
                      stroke="#f5a524" 
                      strokeWidth={2} 
                      fill="url(#uploadGradient)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="download" 
                      name="下载" 
                      stroke="#006FEE" 
                      strokeWidth={2} 
                      fill="url(#downloadGradient)" 
                    />
                  </AreaChart>
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
                    <Bar dataKey="upload" name="上传" fill="#f5a524" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="download" name="下载" fill="#006FEE" radius={[4, 4, 0, 0]} />
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
                    <Bar dataKey="upload" name="上传" fill="#f5a524" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="download" name="下载" fill="#006FEE" radius={[4, 4, 0, 0]} />
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
                    <Bar dataKey="upload" name="上传" fill="#f5a524" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="download" name="下载" fill="#006FEE" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
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
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m.replace('-', '年')}月</option>
                  ))}
                </select>
                <span className="text-xs text-foreground-400 ml-2">
                  本月总计: <span className="text-primary">{calcTraffic(providerTotalTraffic)}</span>
                </span>
              </div>
            </div>
            <div className="h-[200px]">
              {providerList.length === 0 ? (
                <div className="h-full flex items-center justify-center text-foreground-400">
                  暂无订阅统计数据
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
                      formatter={(value) => <span style={{ fontSize: '11px', color: '#888' }}>{value}</span>}
                    />
                    {providerList.map((provider, index) => (
                      <Bar 
                        key={provider} 
                        dataKey={provider} 
                        stackId="a"
                        fill={['#006FEE', '#f5a524', '#17c964', '#f31260', '#7828c8', '#0072f5'][index % 6]} 
                        radius={index === providerList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </BasePage>
  )
}

export default Stats
