import React, { Suspense, useMemo, useState } from 'react'
import { Card, CardBody, Tabs, Tab } from '@heroui/react'
import type { EChartsCoreOption } from 'echarts/core'
import { useTheme } from 'next-themes'
import { IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'
import { useTrafficStore } from '@renderer/store/use-traffic-store'

const TrafficEChart = React.lazy(() => import('./traffic-echart'))

interface TooltipSeriesParam {
  axisValueLabel?: string
  color: string
  seriesName: string
  value: number | string | [string | number, number]
}

type HistoryTab = 'realtime' | 'hourly'

function splitTrafficText(value: number, speed: boolean): { amount: string; unit: string } {
  const formatted = calcTraffic(value)
  const parts = formatted.split(' ')
  const amount = parts[0] || '0'
  const unit = `${parts[1] || 'B'}${speed ? '/s' : ''}`
  return { amount, unit }
}

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

const RealtimeSpeedBadges = React.memo(function RealtimeSpeedBadges() {
  const latestTraffic = useTrafficStore((state) => state.trafficHistory.at(-1))
  const currentUploadSpeed = latestTraffic?.upload ?? 0
  const currentDownloadSpeed = latestTraffic?.download ?? 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1">
        <IoArrowUp className="text-cyan-500 text-sm" />
        <span className="text-cyan-500 font-bold">{calcTraffic(currentUploadSpeed)}/s</span>
      </div>
      <div className="flex items-center gap-1">
        <IoArrowDown className="stats-download-accent text-sm" />
        <span className="stats-download-accent font-bold">
          {calcTraffic(currentDownloadSpeed)}/s
        </span>
      </div>
    </div>
  )
})

function ChartLegend(): React.JSX.Element {
  const { t } = useI18n()
  const { theme, systemTheme } = useTheme()
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark'
  const { uploadColor, downloadColor } = getChartColors(isDark)
  const items = [
    { label: t('stats.uploadSpeed'), color: uploadColor },
    { label: t('stats.downloadSpeed'), color: downloadColor }
  ]

  return (
    <div className="pointer-events-none absolute left-1/2 hidden min-w-0 -translate-x-1/2 items-center justify-center gap-5 md:flex">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
          <span
            className="relative inline-flex h-[2px] w-9 shrink-0 items-center rounded-full bg-current"
            style={{ color: item.color }}
          >
            <span
              className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </span>
          <span className="truncate font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 图表共享工具函数 ───

function formatHourLabel(hour: string): string {
  const parts = hour.split('-')
  return parts.length >= 4 ? `${parts[3]}:00` : hour
}

function getChartColors(isDark: boolean) {
  return {
    axisLabelColor: '#94a3b8',
    splitLineColor: 'rgba(148, 163, 184, 0.16)',
    uploadColor: '#06b6d4',
    downloadColor: isDark ? '#9b8bd8' : '#a855f7',
    downloadAreaStart: isDark ? 'rgba(155,139,216,0.22)' : 'rgba(168,85,247,0.40)',
    downloadAreaEnd: isDark ? 'rgba(155,139,216,0.03)' : 'rgba(168,85,247,0.05)'
  }
}

function createBaseChartOption(axisLabelColor: string, splitLineColor: string) {
  return {
    animation: false,
    grid: {
      top: 12,
      right: 12,
      bottom: 24,
      left: 48,
      containLabel: false
    },
    tooltip: {
      trigger: 'axis' as const,
      transitionDuration: 0,
      hideDelay: 120,
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderColor: 'rgba(148,163,184,0.18)',
      textStyle: {
        color: '#0f172a'
      }
    },
    xAxis: {
      type: 'category' as const,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: axisLabelColor,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value' as const,
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: splitLineColor,
          type: 'dashed' as const
        }
      },
      axisLabel: {
        color: axisLabelColor,
        fontSize: 10,
        inside: false,
        margin: 8,
        formatter: (value: number) => calcTrafficInt(value)
      }
    }
  }
}

function createTooltipFormatter(speed: boolean): (params: unknown) => string {
  return (params: unknown) => {
    const tooltipParams = (Array.isArray(params) ? params : [params]) as TooltipSeriesParam[]
    const rows = tooltipParams
      .map((entry) => {
        const rawValue = Array.isArray(entry.value) ? entry.value[1] : entry.value
        const value = Number(rawValue)
        const { amount, unit } = splitTrafficText(value, speed)
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;">
              <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                <span style="width:8px;height:8px;border-radius:9999px;background:${entry.color};display:inline-block;flex:none;"></span>
                <span style="color:#64748b;font-size:12px;white-space:nowrap;">${entry.seriesName}</span>
              </div>
              <div style="display:flex;align-items:baseline;justify-content:flex-end;gap:6px;min-width:0;flex:none;">
                <span style="color:${entry.color};font-weight:700;font-size:13px;line-height:1;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${amount}</span>
                <span style="color:#94a3b8;font-weight:600;font-size:11px;line-height:1;white-space:nowrap;">${unit}</span>
              </div>
            </div>
          `
      })
      .join('')

    const label = tooltipParams[0]?.axisValueLabel ?? ''
    return `
        <div style="padding:2px 0;min-width:148px;">
          <div style="font-size:12px;font-weight:700;line-height:1.1;color:#475569;margin-bottom:${rows ? '8px' : '0'};">${label}</div>
          ${rows}
        </div>
      `
  }
}

// ─── 按数据依赖拆分的图表渲染器 ───
// RealtimeChartRenderer 仅订阅 trafficHistory（~1Hz 高频更新）
// HourlyChartRenderer 仅订阅 hourlyData（30s 低频刷新）
// 当用户切到"每小时"Tab 时，实时数据的订阅完全断开，不再触发任何重渲染

const RealtimeChartRenderer = React.memo(function RealtimeChartRenderer() {
  const { t } = useI18n()
  const { theme, systemTheme } = useTheme()
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark'
  const trafficHistory = useTrafficStore((state) => state.trafficHistory)

  const realtimeData = useMemo(
    () =>
      trafficHistory.reduce(
        (acc, item) => {
          acc.labels.push(item.time)
          acc.upload.push(item.upload)
          acc.download.push(item.download)
          return acc
        },
        { labels: [] as string[], upload: [] as number[], download: [] as number[] }
      ),
    [trafficHistory]
  )

  const chartOption = useMemo(() => {
    const {
      axisLabelColor,
      splitLineColor,
      uploadColor,
      downloadColor,
      downloadAreaStart,
      downloadAreaEnd
    } = getChartColors(isDark)
    const baseOption = createBaseChartOption(axisLabelColor, splitLineColor)

    return {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.28)',
            type: 'dashed'
          }
        },
        formatter: createTooltipFormatter(true)
      },
      xAxis: {
        ...baseOption.xAxis,
        data: realtimeData.labels,
        axisLabel: {
          color: axisLabelColor,
          fontSize: 10,
          interval: Math.max(Math.floor(realtimeData.labels.length / 4), 12),
          formatter: (value: string | number) => {
            const label = String(value)
            return label.length >= 5 ? label.substring(0, 5) : label
          }
        }
      },
      series: [
        {
          name: t('stats.uploadSpeed'),
          type: 'line',
          color: uploadColor,
          smooth: true,
          symbol: 'none',
          data: realtimeData.upload,
          lineStyle: {
            color: uploadColor,
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
                { offset: 0, color: 'rgba(6,182,212,0.40)' },
                { offset: 1, color: 'rgba(6,182,212,0.05)' }
              ]
            }
          },
          emphasis: {
            disabled: true
          }
        },
        {
          name: t('stats.downloadSpeed'),
          type: 'line',
          color: downloadColor,
          smooth: true,
          symbol: 'none',
          data: realtimeData.download,
          lineStyle: {
            color: downloadColor,
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
                { offset: 0, color: downloadAreaStart },
                { offset: 1, color: downloadAreaEnd }
              ]
            }
          },
          emphasis: {
            disabled: true
          }
        }
      ]
    } as EChartsCoreOption
  }, [isDark, realtimeData, t])

  return <TrafficEChart option={chartOption} />
})

const HourlyChartRenderer = React.memo(function HourlyChartRenderer() {
  const { t } = useI18n()
  const { theme, systemTheme } = useTheme()
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark'
  const hourlyData = useTrafficStore((state) => state.hourlyData)

  const formattedHourlyData = useMemo(() => {
    return (hourlyData || []).map((item) => ({
      ...item,
      label: formatHourLabel(item.hour)
    }))
  }, [hourlyData])

  const chartOption = useMemo(() => {
    const { axisLabelColor, splitLineColor, uploadColor, downloadColor } = getChartColors(isDark)
    const baseOption = createBaseChartOption(axisLabelColor, splitLineColor)
    const chartData = formattedHourlyData

    return {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: 'rgba(148, 163, 184, 0.12)'
          }
        },
        formatter: createTooltipFormatter(false)
      },
      xAxis: {
        ...baseOption.xAxis,
        data: chartData.map((item) => item.label),
        axisLabel: {
          color: axisLabelColor,
          fontSize: 10,
          interval: 2
        }
      },
      series: [
        {
          name: t('stats.upload'),
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: {
            color: uploadColor,
            borderRadius: [4, 4, 0, 0]
          },
          data: chartData.map((item) => item.upload)
        },
        {
          name: t('stats.download'),
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: {
            color: downloadColor,
            borderRadius: [4, 4, 0, 0]
          },
          data: chartData.map((item) => item.download)
        }
      ]
    } as EChartsCoreOption
  }, [isDark, formattedHourlyData, t])

  return <TrafficEChart option={chartOption} />
})

const TrafficChart: React.FC = () => {
  const { t } = useI18n()
  const [historyTab, setHistoryTab] = useState<HistoryTab>('realtime')

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default h-full`}
    >
      <CardBody className="p-4">
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Tabs
              size="sm"
              classNames={CARD_STYLES.GLASS_TABS}
              selectedKey={historyTab}
              onSelectionChange={(key) => setHistoryTab(key as HistoryTab)}
            >
              <Tab key="realtime" title={t('stats.realtime')} />
              <Tab key="hourly" title={t('stats.hourly')} />
            </Tabs>
          </div>
          <ChartLegend />
          <div className="min-w-0 justify-self-end">
            {historyTab === 'realtime' && <RealtimeSpeedBadges />}
          </div>
        </div>

        <div className="h-[200px] w-full">
          <Suspense fallback={<div className="h-full w-full" />}>
            {historyTab === 'realtime' ? <RealtimeChartRenderer /> : <HourlyChartRenderer />}
          </Suspense>
        </div>
      </CardBody>
    </Card>
  )
}

export default React.memo(TrafficChart)
