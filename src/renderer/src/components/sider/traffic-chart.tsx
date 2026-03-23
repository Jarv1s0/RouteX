import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

export interface TrafficChartProps {
  data: Array<{ upload: number; download: number; index: number }>
  isActive: boolean
}

function buildDenseCurveSeries(
  values: number[],
  labels: Array<string | number>,
  density: number
): { values: number[]; labels: Array<string | number> } {
  if (values.length <= 1 || density <= 1) {
    return { values, labels }
  }

  const denseValues: number[] = []
  const denseLabels: Array<string | number> = []

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

  const denseData = useMemo(() => {
    const labels = validData.map((item) => item.index)
    return {
      upload: buildDenseCurveSeries(validData.map((item) => item.upload), labels, 5),
      download: buildDenseCurveSeries(validData.map((item) => item.download), labels, 5)
    }
  }, [validData])

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
        data: denseData.upload.labels
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
          data: denseData.upload.values,
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
          data: denseData.download.values,
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
  }, [denseData, downloadColor, uploadColor])

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
