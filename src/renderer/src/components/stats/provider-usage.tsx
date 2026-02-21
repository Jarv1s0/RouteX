import React, { useMemo, useState } from 'react'
import { Card, CardBody, Select, SelectItem, Button } from '@heroui/react'
import { BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { IoCalendar, IoRefresh, IoFilter } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface ProviderUsageProps {
  providerData: { date: string; provider: string; used: number }[]
  currentProviders: string[]
  onRefresh: () => void
}

// Helper functions (duplicated for self-containment)
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

const CustomTooltip = ({ active, payload, label }: { active?: boolean, payload?: any[], label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className={`
        ${CARD_STYLES.GLASS_CARD}
        !border-default-200/50
        px-3 py-2 rounded-xl shadow-xl backdrop-blur-md
      `}>
        <p className="text-xs font-semibold mb-1 text-foreground-500">{label}</p>
        {payload.map((entry: { color?: string; fill?: string; name: string; value: number }, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill }}
            />
            <span className="text-foreground-500">{entry.name}:</span>
            <span className="font-mono font-medium" style={{ color: entry.color || entry.fill }}>
              {calcTraffic(entry.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const ProviderUsage: React.FC<ProviderUsageProps> = ({
  providerData,
  currentProviders,
  onRefresh
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    return localStorage.getItem('stats-selected-provider') || 'all'
  })

  // 获取所有订阅名称（用于下拉菜单）
  const providerList = useMemo(() => {
    if (currentProviders.length > 0) {
      return currentProviders
    }
    const providers = new Set<string>()
    providerData.forEach(item => {
      providers.add(item.provider)
    })
    return Array.from(providers)
  }, [currentProviders, providerData])

  // 可选月份列表
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    providerData.forEach(item => {
      const [year, month] = item.date.split('-')
      months.add(`${year}-${month}`)
    })
    if (months.size === 0) {
      const now = new Date()
      months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(months).sort().reverse()
  }, [providerData])

  // 当前显示的订阅列表
  const displayProviderList = useMemo(() => {
    if (selectedProvider === 'all') return [...providerList].reverse()
    return [selectedProvider]
  }, [selectedProvider, providerList])

  // 订阅统计数据处理
  const providerChartData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    
    const dates: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }
    
    const providersToShow = selectedProvider === 'all' 
      ? Array.from(new Set(providerData.map(item => item.provider)))
      : [selectedProvider]
    
    return dates.map(date => {
      const dayData: Record<string, string | number> = { date: date.split('-')[2] + '日' }
      
      providersToShow.forEach(provider => {
        const todaySnapshot = providerData.find(d => d.date === date && d.provider === provider)
        
        const [y, m, d] = date.split('-').map(Number)
        const prevDateObj = new Date(y, m - 1, d - 1)
        const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevDateObj.getDate()).padStart(2, '0')}`
        const prevSnapshot = providerData.find(d => d.date === prevDateStr && d.provider === provider)
        
        let daily = 0
        if (todaySnapshot && prevSnapshot) {
          daily = Math.max(0, todaySnapshot.used - prevSnapshot.used)
        }
        
        dayData[provider] = daily
      })
      return dayData
    })
  }, [providerData, selectedMonth, selectedProvider])

  const providerTotalTraffic = useMemo(() => {
    let total = 0
    providerChartData.forEach(day => {
      displayProviderList.forEach(provider => {
        total += (day[provider] as number) || 0
      })
    })
    return total
  }, [providerChartData, displayProviderList])

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default h-full`}>
      <CardBody className="p-4">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <div className="w-1.5 h-3.5 bg-primary/80 rounded-full" />
              </div>
              <span className="text-base font-bold text-foreground">订阅数据</span>
            </div>
            {/* Toolbar */}
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
                onPress={onRefresh}
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
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', className: 'text-default-100/30' }} />
                {displayProviderList.map((provider) => {
                  const colorIndex = providerList.indexOf(provider)
                  const colors = ['#006FEE', '#f5a524', '#17c964', '#f31260', '#7828c8', '#0072f5']
                  const fillColor = colors[colorIndex >= 0 ? colorIndex % colors.length : 0]
                  return (
                    <Bar 
                      key={provider} 
                      dataKey={provider}
                      name={provider}
                      fill={fillColor}
                      stackId={selectedProvider === 'all' ? 'a' : undefined}
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
  )
}

export default ProviderUsage
