import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { ECharts, EChartsCoreOption } from 'echarts/core'

echarts.use([BarChart, GridComponent, LegendComponent, LineChart, SVGRenderer, TooltipComponent])

interface TrafficEChartProps {
  option: EChartsCoreOption
}

const TrafficEChart: React.FC<TrafficEChartProps> = ({ option }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const optionRef = useRef(option)

  optionRef.current = option

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let cancelled = false
    let idleId: number | null = null
    let timeoutId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let resizeChartHandler: (() => void) | null = null
    const win = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const initializeChart = (): void => {
      if (cancelled || chartRef.current) {
        return
      }

      const chart = echarts.init(container, undefined, { renderer: 'svg' })
      chartRef.current = chart
      chart.setOption(optionRef.current, {
        lazyUpdate: true,
        notMerge: true
      })

      resizeChartHandler = (): void => {
        chart.resize()
      }

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resizeChartHandler)
        resizeObserver.observe(container)
      } else {
        window.addEventListener('resize', resizeChartHandler)
      }
    }

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(initializeChart, { timeout: 500 })
    } else {
      timeoutId = window.setTimeout(initializeChart, 0)
    }

    return () => {
      cancelled = true
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      resizeObserver?.disconnect()
      if (resizeChartHandler) {
        window.removeEventListener('resize', resizeChartHandler)
      }
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, {
      lazyUpdate: true,
      notMerge: true
    })
  }, [option])

  return <div ref={containerRef} className="h-full w-full" />
}

export default TrafficEChart
