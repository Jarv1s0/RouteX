import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardBody, Select, SelectItem } from '@heroui/react'
import { IoCalendar, IoFilter } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface ProviderUsageProps {
  providerData: { date: string; provider: string; used: number }[]
  currentProviders: { name: string; resetDay?: number }[]
}

interface BillingPeriod {
  start: string
  end: string
  label: string
}

interface DayUsage {
  date: string
  value: number
}

interface ChartPoint extends DayUsage {
  x: number
  y: number
}

const DEFAULT_CHART_WIDTH = 960
const CHART_HEIGHT = 208
const CHART_PADDING = { top: 18, right: -8, bottom: 34, left: 0 }
const SEGMENTED_SELECT_STYLES = {
  trigger:
    'bg-background/92 shadow-sm border-0 data-[hover=true]:bg-background data-[open=true]:bg-background rounded-[14px] h-8 min-h-8 px-3 transition-all',
  value: 'text-sm font-medium text-foreground-600',
  selectorIcon: 'text-default-400',
  popoverContent: CARD_STYLES.GLASS_SELECT.popoverContent
}

function calcTrafficInt(byte: number): string {
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

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatPeriodLabel(date: string): string {
  return date.replace(/-/g, '.')
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function clampResetDate(year: number, monthIndex: number, resetDay: number): Date {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(Math.max(resetDay, 1), daysInMonth))
}

// 按订阅管理里配置的流量结算日切分账期，而不是按自然月统计。
function getBillingPeriodStart(targetDate: Date, resetDay: number): Date {
  const currentResetDate = clampResetDate(targetDate.getFullYear(), targetDate.getMonth(), resetDay)
  if (targetDate >= currentResetDate) return currentResetDate

  const previousMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1)
  return clampResetDate(previousMonth.getFullYear(), previousMonth.getMonth(), resetDay)
}

function getNextBillingPeriodStart(periodStart: Date, resetDay: number): Date {
  const nextMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
  return clampResetDate(nextMonth.getFullYear(), nextMonth.getMonth(), resetDay)
}

function buildBillingPeriods(dates: string[], resetDay: number): BillingPeriod[] {
  const uniquePeriods = new Map<string, BillingPeriod>()

  dates.forEach((dateStr) => {
    const date = parseDate(dateStr)
    const periodStart = getBillingPeriodStart(date, resetDay)
    const nextPeriodStart = getNextBillingPeriodStart(periodStart, resetDay)
    const periodEnd = new Date(nextPeriodStart)
    periodEnd.setDate(periodEnd.getDate() - 1)
    const start = formatDate(periodStart)

    if (!uniquePeriods.has(start)) {
      const end = formatDate(periodEnd)
      uniquePeriods.set(start, {
        start,
        end,
        label: `${formatPeriodLabel(start)} - ${formatPeriodLabel(end)}`
      })
    }
  })

  return Array.from(uniquePeriods.values()).sort((a, b) => b.start.localeCompare(a.start))
}

function getPeriodDates(start: string, end: string): string[] {
  const dates: string[] = []
  const current = parseDate(start)
  const endDate = parseDate(end)

  while (current <= endDate) {
    dates.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

function getPreviousDate(date: string): string {
  const previousDate = parseDate(date)
  previousDate.setDate(previousDate.getDate() - 1)
  return formatDate(previousDate)
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/')
}

function buildSmoothPath(points: ChartPoint[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  const segmentSlopes: number[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const deltaX = next.x - current.x
    segmentSlopes.push(deltaX === 0 ? 0 : (next.y - current.y) / deltaX)
  }

  const tangents = new Array<number>(points.length).fill(0)
  tangents[0] = segmentSlopes[0]
  tangents[points.length - 1] = segmentSlopes[segmentSlopes.length - 1]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previousSlope = segmentSlopes[index - 1]
    const nextSlope = segmentSlopes[index]
    tangents[index] = previousSlope * nextSlope <= 0 ? 0 : (previousSlope + nextSlope) / 2
  }

  for (let index = 0; index < segmentSlopes.length; index += 1) {
    const slope = segmentSlopes[index]
    if (slope === 0) {
      tangents[index] = 0
      tangents[index + 1] = 0
      continue
    }

    const slopeRatioStart = tangents[index] / slope
    const slopeRatioEnd = tangents[index + 1] / slope
    const ratioLength = Math.hypot(slopeRatioStart, slopeRatioEnd)

    if (ratioLength > 3) {
      const scale = 3 / ratioLength
      tangents[index] = scale * slopeRatioStart * slope
      tangents[index + 1] = scale * slopeRatioEnd * slope
    }
  }

  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const deltaX = next.x - current.x
    const segmentMinY = Math.min(current.y, next.y)
    const segmentMaxY = Math.max(current.y, next.y)
    const controlPoint1X = current.x + deltaX / 3
    const controlPoint1Y = Math.min(
      segmentMaxY,
      Math.max(segmentMinY, current.y + (tangents[index] * deltaX) / 3)
    )
    const controlPoint2X = next.x - deltaX / 3
    const controlPoint2Y = Math.min(
      segmentMaxY,
      Math.max(segmentMinY, next.y - (tangents[index + 1] * deltaX) / 3)
    )

    path += ` C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${next.x} ${next.y}`
  }
  return path
}

function buildAreaPath(points: ChartPoint[], baselineY: number): string {
  if (points.length === 0) return ''
  return `${buildSmoothPath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
}

const ProviderUsage: React.FC<ProviderUsageProps> = ({
  providerData,
  currentProviders
}) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    return localStorage.getItem('stats-selected-provider') || ''
  })
  const [selectedPeriodStart, setSelectedPeriodStart] = useState('')
  const [chartWidth, setChartWidth] = useState(DEFAULT_CHART_WIDTH)
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null)

  const providerNameList = useMemo(() => {
    if (currentProviders.length > 0) {
      return currentProviders.map((provider) => provider.name)
    }
    const providers = new Set<string>()
    providerData.forEach((item) => {
      providers.add(item.provider)
    })
    return Array.from(providers)
  }, [currentProviders, providerData])

  const getResetDay = (providerName: string): number => {
    const provider = currentProviders.find((item) => item.name === providerName)
    return provider?.resetDay || 1
  }

  const snapshotMap = useMemo(() => {
    const map = new Map<string, number>()
    providerData.forEach((item) => {
      map.set(`${item.provider}::${item.date}`, item.used)
    })
    return map
  }, [providerData])

  useEffect(() => {
    if (providerNameList.length === 0) return
    if (!selectedProvider || !providerNameList.includes(selectedProvider)) {
      const nextProvider = providerNameList[0]
      setSelectedProvider(nextProvider)
      localStorage.setItem('stats-selected-provider', nextProvider)
    }
  }, [providerNameList, selectedProvider])

  const selectedResetDay = useMemo(() => {
    if (!selectedProvider) return 1
    return getResetDay(selectedProvider)
  }, [selectedProvider])

  const availablePeriods = useMemo(() => {
    if (!selectedProvider) return []
    const providerDates = providerData
      .filter((item) => item.provider === selectedProvider)
      .map((item) => item.date)

    const now = formatDate(new Date())
    return buildBillingPeriods(Array.from(new Set([...providerDates, now])), selectedResetDay)
  }, [providerData, selectedProvider, selectedResetDay])

  useEffect(() => {
    if (availablePeriods.length === 0) {
      setSelectedPeriodStart('')
      return
    }
    if (!availablePeriods.find((period) => period.start === selectedPeriodStart)) {
      setSelectedPeriodStart(availablePeriods[0].start)
    }
  }, [availablePeriods, selectedPeriodStart])

  useEffect(() => {
    const element = chartContainerRef.current
    if (!element) return

    const updateWidth = (): void => {
      const nextWidth = Math.max(320, Math.floor(element.clientWidth || DEFAULT_CHART_WIDTH))
      setChartWidth(nextWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(() => {
      updateWidth()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const activePeriod = useMemo(() => {
    return availablePeriods.find((period) => period.start === selectedPeriodStart) || availablePeriods[0] || null
  }, [availablePeriods, selectedPeriodStart])

  const todayKey = useMemo(() => formatDate(new Date()), [])

  const periodDates = useMemo(() => {
    if (!activePeriod) return []
    return getPeriodDates(activePeriod.start, activePeriod.end)
  }, [activePeriod])

  const dailyUsage = useMemo<DayUsage[]>(() => {
    if (!selectedProvider || periodDates.length === 0) return []

    return periodDates
      .filter((date) => date <= todayKey)
      .map((date) => {
      const todaySnapshot = snapshotMap.get(`${selectedProvider}::${date}`)
      const prevSnapshot = snapshotMap.get(`${selectedProvider}::${getPreviousDate(date)}`)

      let daily = 0
      if (typeof todaySnapshot === 'number' && typeof prevSnapshot === 'number') {
        const diff = todaySnapshot - prevSnapshot
        if (diff < 0) {
          daily = todaySnapshot
        } else if (prevSnapshot > 0 && diff > prevSnapshot * 10 && diff > 1073741824) {
          daily = 0
        } else {
          daily = diff
        }
      } else if (typeof todaySnapshot === 'number') {
        daily = 0
      }

      return { date, value: daily }
    })
  }, [periodDates, selectedProvider, snapshotMap, todayKey])

  const totalTraffic = useMemo(() => dailyUsage.reduce((sum, item) => sum + item.value, 0), [dailyUsage])
  const activeDays = useMemo(() => dailyUsage.filter((item) => item.value > 0).length, [dailyUsage])
  const averageTraffic = useMemo(() => (activeDays > 0 ? totalTraffic / activeDays : 0), [activeDays, totalTraffic])
  const peakDay = useMemo(() => {
    return dailyUsage.reduce<DayUsage | null>((currentMax, item) => {
      if (!currentMax || item.value > currentMax.value) return item
      return currentMax
    }, null)
  }, [dailyUsage])
  const todayTraffic = useMemo(() => {
    return dailyUsage.find((item) => item.date === todayKey)?.value || 0
  }, [dailyUsage, todayKey])

  const chartData = useMemo(() => {
    const innerWidth = chartWidth - CHART_PADDING.left - CHART_PADDING.right
    const innerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
    const baselineY = CHART_PADDING.top + innerHeight
    const maxValue = Math.max(1, ...dailyUsage.map((item) => item.value))
    const dateIndexMap = new Map(periodDates.map((date, index) => [date, index]))

    const points = dailyUsage.map((item, index) => {
      const dateIndex = dateIndexMap.get(item.date) ?? index
      const ratio = periodDates.length > 1 ? dateIndex / (periodDates.length - 1) : 0
      const x = CHART_PADDING.left + innerWidth * ratio
      const y = baselineY - (item.value / maxValue) * innerHeight
      return { ...item, x, y }
    })

    const linePath = buildSmoothPath(points)
    const areaPath = buildAreaPath(points, baselineY)
    const targetLabelCount = Math.min(6, Math.max(3, Math.floor(chartWidth / 150)))
    const labelIndices = Array.from(
      new Set(
        Array.from({ length: targetLabelCount }, (_, slot) =>
          Math.round(((periodDates.length - 1) * slot) / Math.max(1, targetLabelCount - 1))
        )
      )
    ).filter((index) => index >= 0 && index < periodDates.length)

    const labelPoints = labelIndices.map((index) => {
      const ratio = periodDates.length > 1 ? index / (periodDates.length - 1) : 0
      return {
        date: periodDates[index],
        x: CHART_PADDING.left + innerWidth * ratio
      }
    })

    const yAxisTicks = [1, 0.5, 0].map((ratio) => ({
      ratio,
      y: CHART_PADDING.top + innerHeight * (1 - ratio),
      value: maxValue * ratio
    }))

    const hoverZones = points.map((point, index) => {
      const previous = points[index - 1]
      const next = points[index + 1]
      const xStart = previous ? (previous.x + point.x) / 2 : CHART_PADDING.left
      const xEnd = next ? (point.x + next.x) / 2 : chartWidth - CHART_PADDING.right
      return {
        point,
        x: xStart,
        width: Math.max(12, xEnd - xStart)
      }
    })

    return {
      points,
      linePath,
      areaPath,
      baselineY,
      maxValue,
      labelPoints,
      yAxisTicks,
      hoverZones
    }
  }, [chartWidth, dailyUsage, periodDates])

  const todayPoint = useMemo(() => {
    return chartData.points.find((point) => point.date === todayKey) || null
  }, [chartData.points, todayKey])

  const peakPoint = useMemo(() => {
    if (!peakDay) return null
    return chartData.points.find((point) => point.date === peakDay.date) || null
  }, [chartData.points, peakDay])

  const tooltipStyle = useMemo(() => {
    if (!hoveredPoint) return null
    const tooltipWidth = 148
    const left = Math.min(
      Math.max(8, hoveredPoint.x + 12),
      Math.max(8, chartWidth - tooltipWidth - 8)
    )
    const top = Math.max(6, hoveredPoint.y - 58)

    return {
      left,
      top
    }
  }, [chartWidth, hoveredPoint])

  const summaryItems = [
    { label: '本期累计', value: calcTraffic(totalTraffic), tone: 'text-foreground' },
    { label: '今日用量', value: calcTraffic(todayTraffic), tone: 'text-primary' },
    { label: '活跃日均', value: calcTraffic(averageTraffic), tone: 'text-foreground' },
    {
      label: '峰值日',
      value: peakDay && peakDay.value > 0 ? `${formatShortDate(peakDay.date)} · ${calcTraffic(peakDay.value)}` : '暂无',
      tone: 'text-warning'
    }
  ]

  return (
    <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default h-full`}>
      <CardBody className="p-3">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <div className="w-1.5 h-3.5 bg-primary/80 rounded-full" />
              </div>
              <span className="text-base font-bold text-foreground truncate">订阅数据</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Select
                size="sm"
                className="w-[132px]"
                classNames={SEGMENTED_SELECT_STYLES}
                popoverProps={{ classNames: { content: SEGMENTED_SELECT_STYLES.popoverContent } }}
                startContent={<IoFilter className="text-default-400" />}
                selectedKeys={selectedProvider ? [selectedProvider] : []}
                onChange={(e) => {
                  setSelectedProvider(e.target.value)
                  localStorage.setItem('stats-selected-provider', e.target.value)
                }}
                aria-label="选择订阅"
                renderValue={(items) =>
                  items.map((item) => (
                    <span key={item.key} className="text-xs font-medium text-foreground-600">
                      {item.textValue}
                    </span>
                  ))
                }
              >
                {providerNameList.map((provider) => (
                  <SelectItem key={provider} textValue={provider} classNames={{ title: 'text-xs' }}>
                    {provider}
                  </SelectItem>
                ))}
              </Select>

              <Select
                size="sm"
                className="w-[200px]"
                classNames={SEGMENTED_SELECT_STYLES}
                popoverProps={{ classNames: { content: SEGMENTED_SELECT_STYLES.popoverContent } }}
                startContent={<IoCalendar className="text-default-400" />}
                selectedKeys={activePeriod ? [activePeriod.start] : []}
                onChange={(e) => {
                  if (e.target.value) setSelectedPeriodStart(e.target.value)
                }}
                aria-label="选择账期"
                renderValue={(items) =>
                  items.map((item) => (
                    <span key={item.key} className="text-xs font-medium text-foreground-600">
                      {item.textValue}
                    </span>
                  ))
                }
              >
                {availablePeriods.map((period) => (
                  <SelectItem key={period.start} textValue={period.label} classNames={{ title: 'text-xs' }}>
                    {period.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-0.5">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-semibold text-foreground/85 truncate">{selectedProvider || '订阅'}</span>
              {selectedProvider && (
                <>
                  <span className="text-[11px] text-foreground-400">重置日 {selectedResetDay} 号</span>
                  {activePeriod && <span className="text-[11px] text-foreground-400">账期 {activePeriod.label}</span>}
                </>
              )}
            </div>
            <div className="text-[11px] text-foreground-400">活跃 {activeDays} 天</div>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1.5">
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-default-200/50 bg-gradient-to-b from-white/25 to-white/5 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              >
                <div className="text-[11px] text-foreground-400">{item.label}</div>
                <div className={`mt-0.5 text-[12px] font-bold truncate ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="pt-1">
            {providerNameList.length === 0 || !activePeriod ? (
              <div className="h-[180px] flex flex-col items-center justify-center text-foreground-400 gap-2">
                <div className="text-4xl opacity-30">📊</div>
                <div className="text-sm">暂无订阅统计数据</div>
                <div className="text-xs text-foreground-500">订阅流量数据将在每日自动记录</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-[11px] text-foreground-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    峰值日
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    今日
                  </span>
                </div>

                <div ref={chartContainerRef} className="relative w-full" onMouseLeave={() => setHoveredPoint(null)}>
                <svg viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`} className="w-full h-[180px] overflow-visible">
                  <defs>
                    <linearGradient id="provider-usage-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--heroui-primary) / 0.26)" />
                      <stop offset="100%" stopColor="hsl(var(--heroui-primary) / 0.02)" />
                    </linearGradient>
                    <linearGradient id="provider-usage-line" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--heroui-primary) / 0.4)" />
                      <stop offset="100%" stopColor="hsl(var(--heroui-primary))" />
                    </linearGradient>
                  </defs>

                  {chartData.yAxisTicks.map((tick) => {
                    return (
                      <g key={tick.ratio}>
                        <line
                          x1={CHART_PADDING.left}
                          y1={tick.y}
                          x2={chartWidth - CHART_PADDING.right}
                          y2={tick.y}
                          stroke="rgba(148,163,184,0.16)"
                          strokeDasharray="5 5"
                        />
                        <text
                          x={CHART_PADDING.left - 2}
                          y={tick.y + 4}
                          textAnchor="end"
                          fill="rgba(100,116,139,0.78)"
                          fontSize="11"
                        >
                          {calcTrafficInt(tick.value)}
                        </text>
                      </g>
                    )
                  })}

                  {chartData.areaPath && (
                    <path
                      d={chartData.areaPath}
                      fill="url(#provider-usage-area)"
                    />
                  )}

                  {chartData.linePath && (
                    <path
                      d={chartData.linePath}
                      fill="none"
                      stroke="url(#provider-usage-line)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {chartData.hoverZones.map((zone) => (
                    <rect
                      key={zone.point.date}
                      x={zone.x}
                      y={CHART_PADDING.top}
                      width={zone.width}
                      height={chartData.baselineY - CHART_PADDING.top}
                      fill="transparent"
                      onMouseEnter={() => setHoveredPoint(zone.point)}
                    />
                  ))}

                  {peakPoint && (
                    <>
                      <line
                        x1={peakPoint.x}
                        y1={peakPoint.y}
                        x2={peakPoint.x}
                        y2={chartData.baselineY}
                        stroke="hsl(var(--heroui-warning) / 0.28)"
                        strokeDasharray="4 5"
                      />
                      <circle cx={peakPoint.x} cy={peakPoint.y} r="6" fill="hsl(var(--heroui-warning))" />
                      <circle cx={peakPoint.x} cy={peakPoint.y} r="12" fill="hsl(var(--heroui-warning) / 0.3)">
                        <animate attributeName="opacity" values="0.95;0.18;0.95" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    </>
                  )}

                  {todayPoint && (
                    <>
                      <circle cx={todayPoint.x} cy={todayPoint.y} r="4.5" fill="hsl(var(--heroui-primary))" />
                      <circle cx={todayPoint.x} cy={todayPoint.y} r="9" fill="hsl(var(--heroui-primary) / 0.14)" />
                    </>
                  )}

                  {hoveredPoint && (
                    <>
                      <line
                        x1={hoveredPoint.x}
                        y1={hoveredPoint.y}
                        x2={hoveredPoint.x}
                        y2={chartData.baselineY}
                        stroke="rgba(100,116,139,0.28)"
                        strokeDasharray="4 5"
                      />
                      <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="#0f172a" />
                      <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="2.5" fill="#ffffff" />
                    </>
                  )}

                  {chartData.labelPoints.map((point, index) => {
                    const isFirst = index === 0
                    const isLast = index === chartData.labelPoints.length - 1
                    return (
                      <text
                        key={point.date}
                        x={point.x}
                        y={CHART_HEIGHT - 10}
                        textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                        fill="rgba(100,116,139,0.78)"
                        fontSize="11"
                      >
                        {formatShortDate(point.date)}
                      </text>
                    )
                  })}
                </svg>
                {hoveredPoint && tooltipStyle && (
                  <div
                    className="absolute z-10 rounded-xl border border-default-200/60 bg-background/92 px-3 py-2 shadow-xl backdrop-blur-md pointer-events-none"
                    style={tooltipStyle}
                  >
                    <div className="text-[11px] font-semibold text-foreground-700">{hoveredPoint.date}</div>
                    <div className="mt-1 text-[11px] text-foreground-500">当日用量</div>
                    <div className="text-[13px] font-bold text-foreground font-mono">
                      {calcTraffic(hoveredPoint.value)}
                    </div>
                  </div>
                )}
                </div>

              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export default ProviderUsage
