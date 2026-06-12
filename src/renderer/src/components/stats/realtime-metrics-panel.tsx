import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Card, CardBody } from '@heroui/react'
import { IoHardwareChip, IoLink } from 'react-icons/io5'
import type { EChartsCoreOption } from 'echarts/core'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

const TrafficEChart = React.lazy(() => import('./traffic-echart'))
const MAX_POINTS = 32

interface MetricPoint {
  active: number
  tracked: number
  memory: number
  index: number
}

let recentMetricPoints: MetricPoint[] = []

interface MetricSeries {
  name: string
  values: number[]
  color: string
}

interface MiniMetricChartProps {
  title: string
  icon: React.ElementType
  series: MetricSeries[]
  valueFormatter?: (value: number) => string
  axisValueFormatter?: (value: number) => string
  yAxisLeft?: number
  metrics: Array<{
    label: string
    value: string
    className: string
  }>
}

interface TooltipSeriesParam {
  color: string
  seriesName: string
  value: number | string | [string | number, number]
}

function createInitialPoints(): MetricPoint[] {
  return Array.from({ length: MAX_POINTS }, (_, index) => ({
    active: 0,
    tracked: 0,
    memory: 0,
    index
  }))
}

function getInitialMetricPoints(): MetricPoint[] {
  return recentMetricPoints.length > 0 ? recentMetricPoints.slice() : createInitialPoints()
}

const formatIntegerValue = (value: number): string => `${Math.round(value)}`

const MEMORY_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

function scaleMemoryValue(byte: number): { value: number; unit: (typeof MEMORY_UNITS)[number] } {
  let value = byte
  let unitIndex = 0

  while (value >= 1000 && unitIndex < MEMORY_UNITS.length - 1) {
    value /= 1000
    unitIndex += 1
  }

  return { value, unit: MEMORY_UNITS[unitIndex] }
}

const formatMemoryValue = (byte: number): string => {
  const { value, unit } = scaleMemoryValue(byte)
  return unit === 'B' ? `${Math.round(value)} B` : `${value.toFixed(1)} ${unit}`
}

const formatMemoryAxisValue = (byte: number): string => {
  const { value, unit } = scaleMemoryValue(byte)
  return unit === 'B' ? `${Math.round(value)}` : Number(value.toFixed(1)).toString()
}

function MiniMetricChart({
  title,
  icon: Icon,
  series,
  valueFormatter = formatIntegerValue,
  axisValueFormatter = valueFormatter,
  yAxisLeft = 36,
  metrics
}: MiniMetricChartProps) {
  const chartOption = useMemo(() => {
    const axisLabelColor = '#94a3b8'
    const splitLineColor = 'rgba(148, 163, 184, 0.16)'
    const labels = Array.from(
      { length: Math.max(...series.map((item) => item.values.length), 1) },
      (_, index) => String(index + 1)
    )

    return {
      animation: false,
      grid: {
        top: 12,
        right: 10,
        bottom: 24,
        left: yAxisLeft,
        containLabel: false
      },
      tooltip: {
        trigger: 'axis',
        transitionDuration: 0,
        hideDelay: 120,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        padding: 0,
        formatter: (params: unknown) => {
          const tooltipParams = (Array.isArray(params) ? params : [params]) as TooltipSeriesParam[]
          const uid = Math.random().toString(36).substring(7)
          return `
            <style>
              .echart-glass-tooltip-${uid} {
                background: rgba(255, 255, 255, 0.4);
                backdrop-filter: blur(12px) saturate(150%);
                border: 1px solid rgba(255, 255, 255, 0.5);
                padding: 8px 12px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
              }
              .dark .echart-glass-tooltip-${uid} {
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.1);
              }
            </style>
            <div class="echart-glass-tooltip-${uid}">
              ${tooltipParams
                .map((entry) => {
                  const rawValue = Array.isArray(entry.value) ? entry.value[1] : entry.value
                  return `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;min-width:128px;margin-bottom:4px;">
                      <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                        <span style="width:8px;height:8px;border-radius:9999px;background:${entry.color};display:inline-block;flex:none;box-shadow: 0 0 6px ${entry.color}"></span>
                        <span style="color:var(--heroui-foreground, #334155);font-size:12px;white-space:nowrap;opacity:0.8;">${entry.seriesName}</span>
                      </div>
                      <span style="color:var(--heroui-foreground, #0f172a);font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${valueFormatter(Number(rawValue))}</span>
                    </div>
                  `
                })
                .join('')}
            </div>
          `
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed'
          }
        },
        axisLabel: {
          color: axisLabelColor,
          fontSize: 10,
          inside: false,
          margin: 8,
          formatter: axisValueFormatter
        }
      },
      series: series.map((item) => ({
        name: item.name,
        type: 'line',
        color: item.color,
        smooth: true,
        symbol: 'none',
        data: item.values,
        lineStyle: {
          color: item.color,
          width: 2.25,
          opacity: 1,
          cap: 'round',
          join: 'round'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${item.color}66` },
              { offset: 1, color: `${item.color}0D` }
            ]
          }
        },
        emphasis: {
          disabled: true
        }
      }))
    } as EChartsCoreOption
  }, [axisValueFormatter, series, valueFormatter, yAxisLeft])

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default h-full`}
    >
      <CardBody className="flex h-full min-h-[260px] flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="text-lg text-foreground-500" />
            <span className="truncate text-base font-bold text-foreground">{title}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex min-w-0 items-baseline gap-1.5">
              <span className={`text-sm font-bold tabular-nums ${metric.className}`}>
                {metric.value}
              </span>
              <span className="truncate text-[11px] font-medium text-foreground-400">
                {metric.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 min-h-[142px] flex-1">
          <Suspense fallback={<div className="h-full w-full" />}>
            <TrafficEChart option={chartOption} />
          </Suspense>
        </div>
      </CardBody>
    </Card>
  )
}

const RealtimeMetricsPanel: React.FC = () => {
  const { t } = useI18n()
  const [points, setPoints] = useState<MetricPoint[]>(getInitialMetricPoints)

  // 以固定 1Hz 采样 store 状态，避免高连接场景下每秒触发数十次重渲染
  useEffect(() => {
    const sampleMetrics = (): void => {
      const state = useConnectionsStore.getState()
      const active = state.connectionCount || state.activeConnections.length
      const tracked =
        state.trackedConnectionCount ||
        state.activeConnections.length + state.closedConnections.length

      setPoints((prev) => {
        const nextPoints = [
          ...prev,
          { active, tracked, memory: state.memory, index: Date.now() }
        ].slice(-MAX_POINTS)
        recentMetricPoints = nextPoints
        return nextPoints
      })
    }

    sampleMetrics()
    const timer = setInterval(sampleMetrics, 1000)
    return () => clearInterval(timer)
  }, [])

  const latestPoint = points[points.length - 1]
  const activeCount = latestPoint?.active ?? 0
  const trackedCount = latestPoint?.tracked ?? 0
  const memory = latestPoint?.memory ?? 0
  const memoryPeak = useMemo(() => Math.max(...points.map((point) => point.memory)), [points])

  return (
    <div className="grid h-full grid-cols-1 gap-2 md:grid-cols-2">
      <MiniMetricChart
        title={t('stats.connections')}
        icon={IoLink}
        metrics={[
          {
            label: t('stats.active'),
            value: String(activeCount),
            className: 'text-emerald-500'
          },
          {
            label: t('stats.tracked'),
            value: String(trackedCount),
            className: 'text-amber-500'
          }
        ]}
        series={[
          {
            name: t('stats.active'),
            values: points.map((point) => point.active),
            color: '#22c55e'
          },
          {
            name: t('stats.tracked'),
            values: points.map((point) => point.tracked),
            color: '#f59e0b'
          }
        ]}
      />
      <MiniMetricChart
        title={t('stats.memory')}
        icon={IoHardwareChip}
        metrics={[
          {
            label: t('stats.current'),
            value: formatMemoryValue(memory),
            className: 'text-sky-500'
          },
          {
            label: t('stats.peak'),
            value: formatMemoryValue(memoryPeak),
            className: 'text-amber-500'
          }
        ]}
        series={[
          {
            name: t('stats.memory'),
            values: points.map((point) => point.memory),
            color: '#0ea5e9'
          }
        ]}
        valueFormatter={formatMemoryValue}
        axisValueFormatter={formatMemoryAxisValue}
        yAxisLeft={42}
      />
    </div>
  )
}

export default RealtimeMetricsPanel
