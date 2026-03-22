import React, { useMemo, useState } from 'react'
import { Card, CardBody, Select, SelectItem, Button } from '@heroui/react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { IoCalendar, IoRefresh, IoFilter } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface ProviderUsageProps {
  providerData: { date: string; provider: string; used: number }[]
  currentProviders: { name: string; resetDay?: number }[]
  onRefresh: () => void
}

interface TooltipSeriesParam {
  axisValueLabel?: string
  color: string
  seriesName: string
  value: number | string
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

const PROVIDER_COLORS = ['#006FEE', '#f5a524', '#17c964', '#f31260', '#7828c8', '#0072f5']

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

  const providerNameList = useMemo(() => {
    if (currentProviders.length > 0) {
      return currentProviders.map((p) => p.name)
    }
    const providers = new Set<string>()
    providerData.forEach((item) => {
      providers.add(item.provider)
    })
    return Array.from(providers)
  }, [currentProviders, providerData])

  const getResetDay = (providerName: string): number => {
    const p = currentProviders.find((item) => item.name === providerName)
    return p?.resetDay || 1
  }

  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    providerData.forEach((item) => {
      const [year, month] = item.date.split('-')
      months.add(`${year}-${month}`)
    })
    if (months.size === 0) {
      const now = new Date()
      months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
    return Array.from(months).sort().reverse()
  }, [providerData])

  const displayProviderList = useMemo(() => {
    if (selectedProvider === 'all') return [...providerNameList].reverse()
    return [selectedProvider]
  }, [selectedProvider, providerNameList])

  const providerChartData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()

    const dates: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    }

    const providersToShow =
      selectedProvider === 'all'
        ? Array.from(new Set(providerData.map((item) => item.provider)))
        : [selectedProvider]

    return dates.map((date) => {
      const dayData: Record<string, string | number> = { date: `${date.split('-')[2]}日` }

      providersToShow.forEach((provider) => {
        const todaySnapshot = providerData.find((d) => d.date === date && d.provider === provider)

        const [y, m, d] = date.split('-').map(Number)
        const prevDateObj = new Date(y, m - 1, d - 1)
        const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevDateObj.getDate()).padStart(2, '0')}`
        const prevSnapshot = providerData.find((item) => item.date === prevDateStr && item.provider === provider)

        let daily = 0
        if (todaySnapshot && prevSnapshot) {
          const diff = todaySnapshot.used - prevSnapshot.used
          if (diff < 0) {
            daily = todaySnapshot.used
          } else if (prevSnapshot.used > 0 && diff > prevSnapshot.used * 10 && diff > 1073741824) {
            daily = 0
          } else {
            daily = diff
          }
        } else if (todaySnapshot && !prevSnapshot) {
          daily = 0
        }

        dayData[provider] = daily
      })
      return dayData
    })
  }, [providerData, selectedMonth, selectedProvider])

  const providerTotalTraffic = useMemo(() => {
    const resetDay = selectedProvider !== 'all' ? getResetDay(selectedProvider) : 1

    let total = 0
    providerChartData.forEach((day, index) => {
      const dayNum = index + 1
      if (dayNum >= resetDay) {
        displayProviderList.forEach((provider) => {
          total += (day[provider] as number) || 0
        })
      }
    })
    return total
  }, [displayProviderList, providerChartData, selectedProvider, currentProviders])

  const chartOption = useMemo<EChartsOption>(() => {
    return {
      animation: false,
      grid: {
        top: 12,
        right: 8,
        bottom: 8,
        left: 42,
        containLabel: true
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
          shadowStyle: {
            color: 'rgba(148, 163, 184, 0.12)'
          }
        },
        backgroundColor: 'rgba(255,255,255,0.88)',
        borderColor: 'rgba(148,163,184,0.18)',
        textStyle: {
          color: '#0f172a'
        },
        formatter: (params: unknown) => {
          const tooltipParams = (Array.isArray(params) ? params : [params]) as TooltipSeriesParam[]
          const rows = tooltipParams
            .filter((entry) => Number(entry.value) > 0)
            .map((entry) => {
              return `
                <div style="display:flex;align-items:center;gap:8px;font-size:12px;margin-top:4px;">
                  <span style="width:8px;height:8px;border-radius:9999px;background:${entry.color};display:inline-block;"></span>
                  <span style="color:#64748b;">${entry.seriesName}:</span>
                  <span style="color:${entry.color};font-weight:600;font-family:monospace;">${calcTraffic(Number(entry.value))}</span>
                </div>
              `
            })
            .join('')

          const label = tooltipParams[0]?.axisValueLabel ?? ''
          return `
            <div style="padding:4px 0;">
              <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:${rows ? '4px' : '0'};">${label}</div>
              ${rows || '<div style="font-size:12px;color:#94a3b8;">暂无数据</div>'}
            </div>
          `
        }
      },
      xAxis: {
        type: 'category',
        data: providerChartData.map((item) => item.date as string),
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          interval: 2
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
            color: 'rgba(148, 163, 184, 0.16)',
            type: 'dashed'
          }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          formatter: (value: number) => calcTrafficInt(value)
        }
      },
      series: displayProviderList.map((provider) => {
        const colorIndex = providerNameList.indexOf(provider)
        const baseColor = PROVIDER_COLORS[colorIndex >= 0 ? colorIndex % PROVIDER_COLORS.length : 0]

        return {
          name: provider,
          type: 'bar',
          stack: selectedProvider === 'all' ? 'providers' : undefined,
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${baseColor}E6` },
                { offset: 1, color: `${baseColor}66` }
              ]
            }
          },
          emphasis: {
            focus: 'series'
          },
          data: providerChartData.map((item) => Number(item[provider] ?? 0))
        }
      })
    }
  }, [displayProviderList, providerChartData, providerNameList, selectedProvider])

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
            <div className={`${CARD_STYLES.GLASS_TOOLBAR} px-1.5 py-1.5 rounded-2xl gap-2`}>
              <div className="flex items-center gap-2 px-3 py-1 bg-default-100/50 rounded-xl border border-default-200/50 shadow-sm backdrop-blur-sm">
                <span className="text-xs text-foreground-500">
                  {selectedProvider !== 'all' && getResetDay(selectedProvider) !== 1 ? '本期使用' : '本月使用'}
                </span>
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
                renderValue={(items) =>
                  items.map((item) => (
                    <span key={item.key} className="text-xs font-medium text-foreground-600">
                      {item.textValue}
                    </span>
                  ))
                }
              >
                {['all', ...providerNameList].map((p) => (
                  <SelectItem key={p} textValue={p === 'all' ? '全部订阅' : p} classNames={{ title: 'text-xs' }}>
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
                renderValue={(items) =>
                  items.map((item) => (
                    <span key={item.key} className="text-xs font-medium text-foreground-600">
                      {item.textValue}
                    </span>
                  ))
                }
                aria-label="选择月份"
              >
                {availableMonths.map((m) => (
                  <SelectItem key={m} textValue={m.replace('-', '.')} classNames={{ title: 'text-xs' }}>
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
        <div className="h-[220px] lg:h-[280px] transition-all">
          {providerNameList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-foreground-400 gap-2">
              <div className="text-4xl opacity-30">📊</div>
              <div className="text-sm">暂无订阅统计数据</div>
              <div className="text-xs text-foreground-500">订阅流量数据将在每日自动记录</div>
            </div>
          ) : (
            <ReactECharts option={chartOption} notMerge lazyUpdate style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default ProviderUsage
