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

const formatMemoryValue = (byte: number): string => {
  if (byte < 1000) return `${Math.round(byte)} B`
  byte /= 1000
  if (byte < 1000) return `${byte.toFixed(1)} KB`
  byte /= 1000
  if (byte < 1000) return `${byte.toFixed(1)} MB`
  byte /= 1000
  if (byte < 1000) return `${byte.toFixed(1)} GB`
  byte /= 1000
  return `${byte.toFixed(1)} TB`
}

const formatMemoryAxisValue = (byte: number): string => {
  if (byte < 1000) return `${Math.round(byte)}`
  byte /= 1000
  if (byte < 1000) return Number(byte.toFixed(1)).toString()
  byte /= 1000
  if (byte < 1000) return Number(byte.toFixed(1)).toString()
  byte /= 1000
  if (byte < 1000) return Number(byte.toFixed(1)).toString()
  byte /= 1000
  return Number(byte.toFixed(1)).toString()
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
        backgroundColor: 'rgba(255,255,255,0.88)',
        borderColor: 'rgba(148,163,184,0.18)',
        textStyle: {
          color: '#0f172a'
        },
        formatter: (params: unknown) => {
          const tooltipParams = (Array.isArray(params) ? params : [params]) as TooltipSeriesParam[]
          return tooltipParams
            .map((entry) => {
              const rawValue = Array.isArray(entry.value) ? entry.value[1] : entry.value
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;min-width:128px;">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <span style="width:8px;height:8px;border-radius:9999px;background:${entry.color};display:inline-block;flex:none;"></span>
                    <span style="color:#334155;font-size:12px;white-space:nowrap;">${entry.seriesName}</span>
                  </div>
                  <span style="color:#0f172a;font-size:13px;font-weight:800;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${valueFormatter(Number(rawValue))}</span>
                </div>
              `
            })
            .join('')
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
