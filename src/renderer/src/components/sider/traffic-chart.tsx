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
      return Array(10)
        .fill(0)
        .map((_, i) => ({ upload: 0, download: 0, index: i }))
    }
    return data.slice()
  }, [data])

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
        data: validData.map((item) => item.index)
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
          smooth: true,
          symbol: 'none',
          data: validData.map((item) => item.upload),
          lineStyle: {
            color: uploadColor,
            width: 1.5,
            opacity: 0.8
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
            opacity: 0.18
          }
        },
        {
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: validData.map((item) => item.download),
          lineStyle: {
            color: downloadColor,
            width: 1.5,
            opacity: 0.8
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
            opacity: 0.16
          }
        }
      ]
    }
  }, [downloadColor, uploadColor, validData])

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none rounded-[14px]"
      style={{ height: '100%', width: '100%', minWidth: 1, minHeight: 1 }}
    >
      <ReactECharts option={option} notMerge lazyUpdate style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

export default React.memo(TrafficChart, (prevProps, nextProps) => {
  return prevProps.isActive === nextProps.isActive && prevProps.data === nextProps.data
})
