import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

export interface TrafficChartProps {
  data: Array<{ upload: number; download: number; index: number }>
  isActive: boolean
}

const TrafficChart: React.FC<TrafficChartProps> = (props) => {
  const { data, isActive } = props

  const validData = useMemo(() => {
    if (!data || data.length === 0) {
      return Array(16)
        .fill(0)
        .map((_, i) => ({ upload: 0, download: 0, index: i }))
    }
    return data.slice()
  }, [data])
  const chartLabels = useMemo(() => validData.map((item) => item.index), [validData])
  const uploadSeries = useMemo(() => validData.map((item) => item.upload), [validData])
  const downloadSeries = useMemo(() => validData.map((item) => item.download), [validData])

  const uploadColor = isActive ? '#ffffff' : '#22d3ee'
  const downloadColor = isActive ? '#ffffffcc' : '#c084fc'

  const option = useMemo<EChartsOption>(() => {
    return {
      animation: false,
      grid: {
        top: 6,
        right: 0,
        bottom: 0,
        left: 0,
        containLabel: false
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        show: false,
        data: chartLabels
      },
      yAxis: {
        type: 'value',
        show: false
      },
      tooltip: {
        show: false
      },
      series: [
        {
          type: 'line',
          color: uploadColor,
          smooth: true,
          symbol: 'none',
          data: uploadSeries,
          lineStyle: {
            color: uploadColor,
            width: 2,
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
                { offset: 0, color: uploadColor },
                { offset: 1, color: 'rgba(255,255,255,0.05)' }
              ]
            },
            opacity: 0.12
          }
        },
        {
          type: 'line',
          color: downloadColor,
          smooth: true,
          symbol: 'none',
          data: downloadSeries,
          lineStyle: {
            color: downloadColor,
            width: 2,
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
                { offset: 0, color: downloadColor },
                { offset: 1, color: 'rgba(255,255,255,0.04)' }
              ]
            },
            opacity: 0.1
          }
        }
      ]
    }
  }, [chartLabels, downloadColor, downloadSeries, uploadColor, uploadSeries])

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none rounded-[14px]"
      style={{ height: '100%', width: '100%', minWidth: 1, minHeight: 1 }}
    >
      <ReactECharts
        option={option}
        notMerge
        lazyUpdate
        opts={{ renderer: 'svg' }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}

export default React.memo(TrafficChart, (prevProps, nextProps) => {
  return prevProps.isActive === nextProps.isActive && prevProps.data === nextProps.data
})
