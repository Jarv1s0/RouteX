import React, { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

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

  // 上传淡青色，下载淡紫色
  const uploadColor = isActive ? '#ffffff' : '#22d3ee'
  const downloadColor = isActive ? '#ffffffcc' : '#c084fc'

  const uploadGradientId = `upload-gradient-${isActive ? 'active' : 'inactive'}`
  const downloadGradientId = `download-gradient-${isActive ? 'active' : 'inactive'}`

  return (
    <ResponsiveContainer
      height="100%"
      width="100%"
      minWidth={1}
      minHeight={1}
      className="absolute top-0 left-0 pointer-events-none rounded-[14px]"
    >
      <AreaChart data={validData} margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={uploadGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={uploadColor} stopOpacity={0.5} />
            <stop offset="100%" stopColor={uploadColor} stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id={downloadGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={downloadColor} stopOpacity={0.5} />
            <stop offset="100%" stopColor={downloadColor} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          isAnimationActive={false}
          type="basis"
          dataKey="upload"
          stroke={uploadColor}
          strokeWidth={1.5}
          strokeOpacity={0.8}
          fill={`url(#${uploadGradientId})`}
        />
        <Area
          isAnimationActive={false}
          type="basis"
          dataKey="download"
          stroke={downloadColor}
          strokeWidth={1.5}
          strokeOpacity={0.8}
          fill={`url(#${downloadGradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default React.memo(TrafficChart, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  )
})
