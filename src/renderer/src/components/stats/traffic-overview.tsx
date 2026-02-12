import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'

interface TrafficOverviewProps {
  sessionUpload: number
  sessionDownload: number
  todayUpload: number
  todayDownload: number
}

const TrafficOverview: React.FC<TrafficOverviewProps> = ({
  sessionUpload,
  sessionDownload,
  todayUpload,
  todayDownload
}) => {
  const sessionTotal = sessionUpload + sessionDownload
  const todayTotal = todayUpload + todayDownload

  const sessionData = useMemo(() => [
    { name: 'Upload', value: sessionUpload, color: '#06b6d4', group: '本次' },
    { name: 'Download', value: sessionDownload, color: '#8b5cf6', group: '本次' }
  ], [sessionUpload, sessionDownload])

  const todayData = useMemo(() => [
    { name: 'Upload', value: todayUpload, color: 'rgba(6, 182, 212, 0.5)', group: '今日' },
    { name: 'Download', value: todayDownload, color: 'rgba(139, 92, 246, 0.5)', group: '今日' }
  ], [todayUpload, todayDownload])

  // Helper to safely split traffic string
  const formatTraffic = (bytes: number) => {
    const [val, unit] = calcTraffic(bytes).split(' ')
    return { val, unit }
  }

  const sessionTotalFormatted = formatTraffic(sessionTotal)
  const sessionUploadFormatted = formatTraffic(sessionUpload)
  const sessionDownloadFormatted = formatTraffic(sessionDownload)
  const todayUploadFormatted = formatTraffic(todayUpload)
  const todayDownloadFormatted = formatTraffic(todayDownload)

  return (
    <div className="w-full h-full min-h-[160px]" style={{ containerType: 'inline-size' }}>
      <div className="flex flex-row items-center justify-center gap-[clamp(10px,6cqi,40px)] h-full w-full px-2">
        {/* Left Block (Upload Group) - Pro Max Style */}
        <div className="flex flex-col gap-2 p-3 min-w-[100px] flex-1 items-end relative transition-all" style={{ containerType: 'inline-size' }}>

          {/* Session Upload */}
          <div className="flex flex-col items-end relative z-10 w-full">
            <div className="flex items-center gap-1.5 mb-1 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 self-end">
              <IoArrowUp className="text-cyan-500 text-xs font-bold" />
              <span className="font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide whitespace-nowrap" style={{ fontSize: '9cqw' }}>本次上传</span>
            </div>
            <div className="flex items-baseline gap-1 self-end">
              <span className="font-bold text-cyan-500 font-mono tracking-tight" style={{ fontSize: '18cqw', lineHeight: 1 }}>{sessionUploadFormatted.val}</span>
              <span className="text-default-500 font-medium" style={{ fontSize: '9cqw' }}>{sessionUploadFormatted.unit}</span>
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-default-300/50 to-transparent my-1" />

          {/* Today Upload */}
          <div className="flex flex-col items-end relative z-10 w-full">
            <span className="text-default-400 font-medium mb-0.5 whitespace-nowrap" style={{ fontSize: '9cqw' }}>今日累计</span>
            <div className="flex items-baseline gap-1 self-end">
              <span className="font-semibold text-default-600" style={{ fontSize: '12cqw' }}>{todayUploadFormatted.val}</span>
              <span className="text-default-400" style={{ fontSize: '9cqw' }}>{todayUploadFormatted.unit}</span>
            </div>
          </div>
        </div>

        {/* Center Chart: Double Concentric Donut - Pro Max Geometry */}
        <div className="relative h-full flex-[2] min-w-[140px] max-w-[50%] p-1" style={{ containerType: 'size' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
   {/* ... tooltip ... */}
              <Tooltip 
                formatter={(value: any, name: any, props: any) => {
                  if (value === undefined) return ['-', '']
                  const group = props.payload?.group || ''
                  const type = name === 'Upload' ? '上传' : '下载'
                  return [calcTraffic(value), `${group}${type}`]
                }}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.5)', 
                  boxShadow: '0 8px 16px -2px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px',
                  color: '#000',
                  backdropFilter: 'blur(12px)'
                }}
                itemStyle={{ color: '#000' }}
                cursor={{ fill: 'transparent' }}
              />

              {/* Layer B: Outer Ring (Today) - Translucent colors */}
              <Pie
                data={todayTotal > 0 ? todayData : [{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius="65%" // Percentage for scaling
                outerRadius="80%" // Percentage for scaling
                startAngle={90}
                endAngle={450}
                stroke="none"
                strokeWidth={0}
                cornerRadius={0}
                paddingAngle={0}
                isAnimationActive={false}
              >
                {todayTotal > 0 ? (
                  todayData.map((entry, index) => (
                    <Cell key={`cell-today-${index}`} fill={entry.color} stroke="none" strokeWidth={0} />
                  ))
                ) : (
                  <Cell fill="var(--heroui-default-100)" stroke="none" strokeWidth={0} />
                )}
              </Pie>

              {/* Layer A: Inner Ring (Session) - Solid Vibrant colors */}
              <Pie
                data={sessionTotal > 0 ? sessionData : [{ value: 1 }]}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius="45%" // Percentage for scaling
                outerRadius="55%" // Percentage for scaling
                startAngle={90}
                endAngle={450}
                stroke="none"
                strokeWidth={0}
                cornerRadius={0}
                paddingAngle={0}
                isAnimationActive={false}
              >
                 {sessionTotal > 0 ? (
                  sessionData.map((entry, index) => (
                    <Cell key={`cell-session-${index}`} fill={entry.color} stroke="none" strokeWidth={0} />
                  ))
                ) : (
                  <Cell fill="var(--heroui-default-200)" stroke="none" strokeWidth={0} />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center Label - Pro Max Typography - User Tuned */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="text-default-400 uppercase tracking-[0.2em] mb-[1.5cqh] text-[10px] opacity-80" style={{ fontSize: '4cqw' }}>本次总计</span>
            <div className="flex items-baseline justify-center">
               <span className="font-black text-foreground tabular-nums tracking-tighter drop-shadow-sm" style={{ fontSize: '8cqw', lineHeight: 0.9 }}>
                  {sessionTotalFormatted.val}
               </span>
               <span className="font-bold text-default-400 ml-[0.5cqw]" style={{ fontSize: '3.5cqw' }}>
                  {sessionTotalFormatted.unit}
               </span>
            </div>
          </div>
        </div>

        {/* Right Block (Download Group) - Symmetric Design */}
        <div className="flex flex-col gap-2 p-3 min-w-[100px] flex-1 items-start relative transition-all" style={{ containerType: 'inline-size' }}>

          {/* Session Download */}
          <div className="flex flex-col items-start relative z-10 w-full">
            <div className="flex items-center gap-1.5 mb-1 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 self-start">
              <IoArrowDown className="text-purple-500 text-xs font-bold" />
              <span className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide whitespace-nowrap" style={{ fontSize: '9cqw' }}>本次下载</span>
            </div>
            <div className="flex items-baseline gap-1 self-start">
              <span className="font-bold text-purple-500 font-mono tracking-tight" style={{ fontSize: '18cqw', lineHeight: 1 }}>{sessionDownloadFormatted.val}</span>
              <span className="text-default-500 font-medium" style={{ fontSize: '9cqw' }}>{sessionDownloadFormatted.unit}</span>
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-default-300/50 to-transparent my-1" />

          {/* Today Download */}
          <div className="flex flex-col items-start relative z-10 w-full">
            <span className="text-default-400 font-medium mb-0.5 whitespace-nowrap" style={{ fontSize: '9cqw' }}>今日累计</span>
            <div className="flex items-baseline gap-1 self-start">
              <span className="font-semibold text-default-600" style={{ fontSize: '12cqw' }}>{todayDownloadFormatted.val}</span>
              <span className="text-default-400" style={{ fontSize: '9cqw' }}>{todayDownloadFormatted.unit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrafficOverview
