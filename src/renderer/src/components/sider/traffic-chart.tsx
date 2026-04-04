import React, { useMemo } from 'react'

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
  const uploadSeries = useMemo(() => validData.map((item) => item.upload), [validData])
  const downloadSeries = useMemo(() => validData.map((item) => item.download), [validData])

  const uploadColor = '#22d3ee'
  const downloadColor = '#c084fc'

  const chartGeometry = useMemo(() => {
    const width = 100
    const height = 100
    const paddingX = 2
    const paddingY = 8
    const bottomY = height - paddingY
    const topY = paddingY
    const innerHeight = bottomY - topY
    const maxValue = Math.max(...uploadSeries, ...downloadSeries, 1)
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

    const createPoints = (series: number[]) => {
      const step = series.length > 1 ? (width - paddingX * 2) / (series.length - 1) : 0
      return series.map((value, index) => {
        const x = paddingX + step * index
        const normalized = value / maxValue
        const y = bottomY - normalized * innerHeight
        return { x, y }
      })
    }

    const createSmoothLinePath = (points: { x: number; y: number }[]) => {
      if (points.length === 0) {
        return ''
      }

      if (points.length === 1) {
        return `M ${points[0].x} ${points[0].y}`
      }

      let path = `M ${points[0].x} ${points[0].y}`

      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i]
        const next = points[i + 1]
        const previous = points[i - 1] ?? current
        const afterNext = points[i + 2] ?? next

        const controlPoint1X = clamp(current.x + (next.x - previous.x) / 6, paddingX, width - paddingX)
        const controlPoint1Y = clamp(current.y + (next.y - previous.y) / 6, topY, bottomY)
        const controlPoint2X = clamp(next.x - (afterNext.x - current.x) / 6, paddingX, width - paddingX)
        const controlPoint2Y = clamp(next.y - (afterNext.y - current.y) / 6, topY, bottomY)

        path += ` C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${next.x} ${next.y}`
      }

      return path
    }

    const createAreaPath = (points: { x: number; y: number }[]) => {
      if (points.length === 0) {
        return ''
      }

      const linePath = createSmoothLinePath(points)
      const firstPoint = points[0]
      const lastPoint = points[points.length - 1]
      return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`
    }

    const uploadPoints = createPoints(uploadSeries)
    const downloadPoints = createPoints(downloadSeries)

    return {
      chartClipId: isActive ? 'conn-chart-clip-active' : 'conn-chart-clip',
      uploadAreaPath: createAreaPath(uploadPoints),
      uploadLinePath: createSmoothLinePath(uploadPoints),
      downloadAreaPath: createAreaPath(downloadPoints),
      downloadLinePath: createSmoothLinePath(downloadPoints)
    }
  }, [downloadSeries, isActive, uploadSeries])

  return (
    <div
      className="absolute top-0 left-0 pointer-events-none rounded-[14px]"
      style={{ height: '100%', width: '100%', minWidth: 1, minHeight: 1 }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="h-full w-full"
      >
        <defs>
          <clipPath id={chartGeometry.chartClipId}>
            <rect x="0" y="0" width="100" height="100" rx="14" ry="14" />
          </clipPath>
          <linearGradient id={isActive ? 'conn-upload-active' : 'conn-upload'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={uploadColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={uploadColor} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={isActive ? 'conn-download-active' : 'conn-download'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={downloadColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={downloadColor} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${chartGeometry.chartClipId})`}>
          <path
            d={chartGeometry.uploadAreaPath}
            fill={`url(#${isActive ? 'conn-upload-active' : 'conn-upload'})`}
          />
          <path
            d={chartGeometry.uploadLinePath}
            fill="none"
            stroke={uploadColor}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={chartGeometry.downloadAreaPath}
            fill={`url(#${isActive ? 'conn-download-active' : 'conn-download'})`}
          />
          <path
            d={chartGeometry.downloadLinePath}
            fill="none"
            stroke={downloadColor}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
    </div>
  )
}

export default React.memo(TrafficChart, (prevProps, nextProps) => {
  return prevProps.isActive === nextProps.isActive && prevProps.data === nextProps.data
})
