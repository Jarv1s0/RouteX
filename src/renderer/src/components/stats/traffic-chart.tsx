import React, { useMemo, useState } from 'react'
import { Card, CardBody, Tabs, Tab } from '@heroui/react'
import { Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, BarChart, Legend, ComposedChart, CartesianGrid } from 'recharts'
import { IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface TrafficDataPoint {
  time: string
  upload: number
  download: number
}

interface TrafficChartProps {
  trafficHistory: TrafficDataPoint[]
  hourlyData: { hour: string; upload: number; download: number }[]
  dailyData: { date: string; upload: number; download: number }[]
}

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

interface TooltipPayloadEntry {
  color?: string
  fill?: string
  name: string
  value: number
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: TooltipPayloadEntry[], label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`
        ${CARD_STYLES.GLASS_CARD}
        !border-default-200/50
        px-3 py-2 rounded-xl shadow-xl backdrop-blur-md
      `}>
        <p className="text-xs font-semibold mb-1 text-foreground-500">{label}</p>
        {payload.map((entry, index) => (
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

const TrafficChart: React.FC<TrafficChartProps> = ({
  trafficHistory,
  hourlyData,
  dailyData
}) => {
  const [historyTab, setHistoryTab] = useState<'realtime' | 'hourly' | 'daily' | 'monthly'>('realtime')

  const currentUploadSpeed = trafficHistory.length > 0 ? trafficHistory[trafficHistory.length - 1].upload : 0
  const currentDownloadSpeed = trafficHistory.length > 0 ? trafficHistory[trafficHistory.length - 1].download : 0

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

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default h-full`}>
      <CardBody className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <Tabs 
              size="sm"
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
                      type="basis" 
                      dataKey="upload" 
                      name="上传速度" 
                      stroke="#06b6d4" 
                      strokeWidth={2} 
                      fill="url(#uploadGradient)"
                      isAnimationActive={true}
                      animationDuration={500}
                    />
                    <Area 
                      type="basis" 
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
  )
}

export default TrafficChart
