import React, { useState } from 'react'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'
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
  const [isHovered, setIsHovered] = useState(false)

  const sessionTotal = sessionUpload + sessionDownload

  const formatTraffic = (value: number) => {
    const formatted = calcTraffic(value) // e.g., "1.5 MB" or "0 B"
    const parts = formatted.split(' ')
    const val = parseFloat(parts[0]) || 0
    const unit = parts[1] || 'B'
    return { val, unit }
  }

  const sessionTotalFormatted = formatTraffic(sessionTotal)
  const sessionUploadFormatted = formatTraffic(sessionUpload)
  const sessionDownloadFormatted = formatTraffic(sessionDownload)
  const todayUploadFormatted = formatTraffic(todayUpload)
  const todayDownloadFormatted = formatTraffic(todayDownload)

  const uploadRatio = sessionTotal > 0 ? sessionUpload / sessionTotal : 0

  return (
    <div className="w-full h-full min-h-[160px] flex items-center justify-center p-2" style={{ containerType: 'inline-size' }}>
      <div className="flex flex-row items-center justify-center w-full h-full max-w-[80cqw] mx-auto gap-4 md:gap-8">
        
        {/* Left Block: Upload */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-end flex-1 min-w-0 max-w-[160px]" 
          style={{ containerType: 'inline-size' }}
        >
          {/* 本次上传 */}
          <div className="flex flex-col items-end w-full">
            <div className="flex items-center gap-1.5 mb-1.5 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
              <IoArrowUp className="text-cyan-500 text-[clamp(12px,4cqi,16px)]" />
              <span className="font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap tracking-wide" style={{ fontSize: 'clamp(11px, 4cqi, 14px)' }}>
                本次上传
              </span>
            </div>
            <div className="flex items-baseline gap-1" style={{ fontSize: 'clamp(18px, 9cqi, 36px)' }}>
              <span className="font-extrabold text-cyan-500 font-mono tracking-tight leading-none">
                <CountUp end={sessionUploadFormatted.val} decimals={sessionUploadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="text-cyan-500/70 font-semibold tracking-wider translate-y-[-1px]" style={{ fontSize: 'clamp(11px, 4cqi, 16px)' }}>{sessionUploadFormatted.unit}</span>
            </div>
          </div>
          
          {/* 今日累计 (上传) */}
          <div className="flex flex-col items-end w-full mt-3 opacity-70 transition-opacity duration-300 hover:opacity-100">
            <span className="text-default-400 font-medium whitespace-nowrap mb-0.5 tracking-wider" style={{ fontSize: 'clamp(10px, 3.5cqi, 13px)' }}>
              今日累计
            </span>
            <div className="flex items-baseline gap-1" style={{ fontSize: 'clamp(14px, 5cqi, 20px)' }}>
              <span className="font-semibold text-default-600 leading-none">
                <CountUp end={todayUploadFormatted.val} decimals={todayUploadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="text-default-500/70 uppercase font-medium tracking-wide" style={{ fontSize: 'clamp(10px, 3.5cqi, 13px)' }}>{todayUploadFormatted.unit}</span>
            </div>
          </div>
        </motion.div>

        {/* Center Chart: Responsive Full Circle Slim Donut with Framer Motion */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="flex justify-center items-center flex-[1.5] min-w-[140px] max-w-[240px] relative cursor-default" 
          style={{ containerType: 'inline-size' }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          <svg viewBox="0 0 100 100" className="w-[90%] max-w-[200px] aspect-square -rotate-90 origin-center relative z-10 transition-transform duration-300 hover:scale-[1.03]">
            {/* Background Ring (Purple - Download Track) - Tailwind Purple 500 equivalent: #a855f7 */}
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="transparent"
              stroke="#a855f7"
              strokeWidth="4"
              strokeOpacity="0.4"
            />
            {/* Foreground Ring (Cyan - Upload Ratio) */}
            <motion.circle
              cx="50"
              cy="50"
              r="46"
              fill="transparent"
              stroke="#06b6d4"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 46}
              initial={{ strokeDashoffset: 2 * Math.PI * 46 }}
              animate={{ strokeDashoffset: (2 * Math.PI * 46) * (1 - uploadRatio) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{
                filter: isHovered ? 'drop-shadow(0px 0px 8px rgba(6,182,212,0.6))' : 'none'
              }}
            />
          </svg>
          
          {/* Centered Text inside Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center z-20">
            <span className="text-default-400 font-semibold tracking-[0.2em] opacity-80 mb-1 whitespace-nowrap" style={{ fontSize: 'clamp(10px, 3cqi, 13px)' }}>
              本次总计
            </span>
            <div className="flex items-baseline justify-center" style={{ fontSize: 'clamp(22px, 10cqi, 40px)' }}>
              <span className="font-black text-foreground tabular-nums tracking-tighter leading-none">
                <CountUp end={sessionTotalFormatted.val} decimals={sessionTotalFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="font-bold text-default-400/80 ml-1 translate-y-[-1px] uppercase tracking-wider" style={{ fontSize: 'clamp(11px, 4cqi, 16px)' }}>
                {sessionTotalFormatted.unit}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Right Block: Download */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-start flex-1 min-w-0 max-w-[160px]" 
          style={{ containerType: 'inline-size' }}
        >
          {/* 本次下载 */}
          <div className="flex flex-col items-start w-full">
            <div className="flex items-center gap-1.5 mb-1.5 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
              <IoArrowDown className="text-purple-500 text-[clamp(12px,4cqi,16px)]" />
              <span className="font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap tracking-wide" style={{ fontSize: 'clamp(11px, 4cqi, 14px)' }}>
                本次下载
              </span>
            </div>
            <div className="flex items-baseline gap-1" style={{ fontSize: 'clamp(18px, 9cqi, 36px)' }}>
              <span className="font-extrabold text-purple-500 font-mono tracking-tight leading-none">
                <CountUp end={sessionDownloadFormatted.val} decimals={sessionDownloadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="text-purple-500/70 font-semibold tracking-wider translate-y-[-1px]" style={{ fontSize: 'clamp(11px, 4cqi, 16px)' }}>{sessionDownloadFormatted.unit}</span>
            </div>
          </div>
          
          {/* 今日累计 (下载) */}
          <div className="flex flex-col items-start w-full mt-3 opacity-70 transition-opacity duration-300 hover:opacity-100">
            <span className="text-default-400 font-medium whitespace-nowrap mb-0.5 tracking-wider" style={{ fontSize: 'clamp(10px, 3.5cqi, 13px)' }}>
              今日累计
            </span>
            <div className="flex items-baseline gap-1" style={{ fontSize: 'clamp(14px, 5cqi, 20px)' }}>
              <span className="font-semibold text-default-600 leading-none">
                <CountUp end={todayDownloadFormatted.val} decimals={todayDownloadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="text-default-500/70 uppercase font-medium tracking-wide" style={{ fontSize: 'clamp(10px, 3.5cqi, 13px)' }}>{todayDownloadFormatted.unit}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>

  )
}

export default TrafficOverview
