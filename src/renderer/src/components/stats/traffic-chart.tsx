import React, { useMemo, useState } from 'react'
import { Card, CardBody, Tabs, Tab } from '@heroui/react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
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

interface TooltipSeriesParam {
  axisValueLabel?: string
  color: string
  seriesName: string
  value: number | string | [string | number, number]
}

function splitTrafficText(value: number, speed: boolean): { amount: string; unit: string } {
  const formatted = calcTraffic(value)
  const parts = formatted.split(' ')
  const amount = parts[0] || '0'
  const unit = `${parts[1] || 'B'}${speed ? '/s' : ''}`
  return { amount, unit }
}

function buildDenseCurveSeries(
  values: number[],
  labels: string[],
  density: number
): { values: number[]; labels: string[] } {
  if (values.length <= 1 || density <= 1) {
    return { values, labels }
  }

  const denseValues: number[] = []
  const denseLabels: string[] = []

  const interpolate = (start: number, end: number, t: number): number => {
    const easedT = (1 - Math.cos(Math.PI * t)) / 2
    return start * (1 - easedT) + end * easedT
  }

  for (let index = 0; index < values.length - 1; index += 1) {
    for (let step = 0; step < density; step += 1) {
      const t = step / density
      denseValues.push(interpolate(values[index], values[index + 1], t))
      denseLabels.push(labels[index])
    }
  }

  denseValues.push(values[values.length - 1])
  denseLabels.push(labels[labels.length - 1])

  return { values: denseValues, labels: denseLabels }
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
    return (hourlyData || []).map((item) => ({
      ...item,
      label: formatHourLabel(item.hour)
    }))
  }, [hourlyData])

  const formattedDailyData = useMemo(() => {
    return (dailyData || []).slice(-7).map((item) => ({
      ...item,
      label: formatDateLabel(item.date)
    }))
  }, [dailyData])

  const formattedMonthlyData = useMemo(() => {
    return (dailyData || []).map((item) => ({
      ...item,
      label: formatDateLabel(item.date)
    }))
  }, [dailyData])

  const totalUpload7d = (dailyData || []).slice(-7).reduce((sum, d) => sum + d.upload, 0)
  const totalDownload7d = (dailyData || []).slice(-7).reduce((sum, d) => sum + d.download, 0)
  const totalUpload = (dailyData || []).reduce((sum, d) => sum + d.upload, 0)
  const totalDownload = (dailyData || []).reduce((sum, d) => sum + d.download, 0)

  const denseRealtimeSeries = useMemo(() => {
    const labels = trafficHistory.map((item) => item.time)
    return {
      upload: buildDenseCurveSeries(trafficHistory.map((item) => item.upload), labels, 5),
      download: buildDenseCurveSeries(trafficHistory.map((item) => item.download), labels, 5)
    }
  }, [trafficHistory])

  const chartOption = useMemo(() => {
    const axisLabelColor = '#94a3b8'
    const splitLineColor = 'rgba(148, 163, 184, 0.16)'
    const uploadColor = '#06b6d4'
    const downloadColor = '#a855f7'

    const createTooltipFormatter = (speed = false) => (params: unknown) => {
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

    const baseOption = {
      animation: false,
      grid: {
        top: 36,
        right: 12,
        bottom: 8,
        left: 48,
        containLabel: true
      },
      legend: {
        top: 0,
        textStyle: {
          color: '#64748b',
          fontSize: 12
        }
      },
      tooltip: {
        trigger: 'axis',
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
          formatter: (value: number) => calcTrafficInt(value)
        }
      }
    }

    if (historyTab === 'realtime') {
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
          data: denseRealtimeSeries.upload.labels,
          axisLabel: {
            color: axisLabelColor,
            fontSize: 10,
            interval: Math.max(Math.floor(denseRealtimeSeries.upload.labels.length / 4), 12),
            formatter: (value: string | number) => {
              const label = String(value)
              return label.length >= 5 ? label.substring(0, 5) : label
            }
          }
        },
        series: [
          {
            name: '上传速度',
            type: 'line',
            color: uploadColor,
            smooth: true,
            symbol: 'none',
            data: denseRealtimeSeries.upload.values,
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
            name: '下载速度',
            type: 'line',
            color: downloadColor,
            smooth: true,
            symbol: 'none',
            data: denseRealtimeSeries.download.values,
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
                  { offset: 0, color: 'rgba(168,85,247,0.40)' },
                  { offset: 1, color: 'rgba(168,85,247,0.05)' }
                ]
              }
            },
            emphasis: {
              disabled: true
            }
          }
        ]
      } as EChartsOption
    }

    const chartData =
      historyTab === 'hourly'
        ? formattedHourlyData
        : historyTab === 'daily'
          ? formattedDailyData
          : formattedMonthlyData

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
          interval: historyTab === 'hourly' ? 2 : historyTab === 'monthly' ? 4 : 0
        }
      },
      series: [
        {
          name: '上传',
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: {
            color: uploadColor,
            borderRadius: [4, 4, 0, 0]
          },
          data: chartData.map((item) => item.upload)
        },
        {
          name: '下载',
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: {
            color: downloadColor,
            borderRadius: [4, 4, 0, 0]
          },
          data: chartData.map((item) => item.download)
        }
      ]
    } as EChartsOption
  }, [
    formattedDailyData,
    formattedHourlyData,
    formattedMonthlyData,
    denseRealtimeSeries,
    historyTab,
    trafficHistory
  ])

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
          <ReactECharts
            option={chartOption}
            notMerge
            lazyUpdate
            opts={{ renderer: 'svg' }}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </CardBody>
    </Card>
  )
}

export default TrafficChart
