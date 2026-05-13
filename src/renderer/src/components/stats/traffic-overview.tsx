import React, { useState } from 'react'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { calcTraffic } from '@renderer/utils/calc'
import { useI18n } from '@renderer/i18n'

interface TrafficOverviewProps {
  sessionUpload: number
  sessionDownload: number
  todayUpload: number
  todayDownload: number
}

const UPLOAD_COLOR = '#06b6d4'
const UPLOAD_COLOR_SOFT = 'rgba(6, 182, 212, 0.10)'
const UPLOAD_COLOR_BORDER = 'rgba(6, 182, 212, 0.22)'
const UPLOAD_GLOW = 'rgba(6, 182, 212, 0.42)'

const DOWNLOAD_COLOR = '#a855f7'
const DOWNLOAD_COLOR_SOFT = 'rgba(168, 85, 247, 0.10)'
const DOWNLOAD_COLOR_BORDER = 'rgba(168, 85, 247, 0.22)'

const METRIC_LABEL_CLASS =
  'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-left'
const METRIC_LABEL_TEXT_CLASS = 'min-w-0 font-bold leading-tight tracking-wide'
const METRIC_VALUE_CLASS = 'flex max-w-full items-baseline gap-1.5'
const SECONDARY_METRIC_CLASS =
  'text-default-400 font-medium mb-0.5 tracking-wider leading-tight'

const TrafficOverview: React.FC<TrafficOverviewProps> = ({
  sessionUpload,
  sessionDownload,
  todayUpload,
  todayDownload
}) => {
  const { t } = useI18n()
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
      <div className="grid w-full max-w-[720px] grid-cols-[minmax(0,1fr)_minmax(120px,1.15fr)_minmax(0,1fr)] items-center gap-2 md:gap-4">
        
        {/* Left Block: Upload */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex min-w-0 flex-col items-end"
          style={{ containerType: 'inline-size' }}
        >
          {/* 本次上传 */}
          <div className="flex flex-col items-end w-full">
            <div
              className={`${METRIC_LABEL_CLASS} mb-1.5 justify-start`}
              style={{ backgroundColor: UPLOAD_COLOR_SOFT, borderColor: UPLOAD_COLOR_BORDER }}
            >
              <IoArrowUp className="shrink-0 text-[clamp(12px,4cqi,16px)]" style={{ color: UPLOAD_COLOR }} />
              <span
                className={`${METRIC_LABEL_TEXT_CLASS} text-left`}
                style={{ fontSize: 'clamp(11px, 4cqi, 14px)', color: UPLOAD_COLOR }}
              >
                {t('stats.sessionUpload')}
              </span>
            </div>
            <div className={`${METRIC_VALUE_CLASS} justify-end`} style={{ fontSize: 'clamp(18px, 9cqi, 36px)' }}>
              <span 
                className="font-bold font-data-numeric tabular-nums leading-none bg-clip-text text-transparent bg-gradient-to-br from-cyan-300 to-cyan-600"
              >
                <CountUp end={sessionUploadFormatted.val} decimals={sessionUploadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span
                className="font-medium tracking-widest translate-y-[-1px] opacity-70"
                style={{ fontSize: 'clamp(10px, 3.5cqi, 14px)', color: UPLOAD_COLOR }}
              >
                {sessionUploadFormatted.unit}
              </span>
            </div>
          </div>
          
          {/* 今日累计 (上传) */}
          <div className="flex flex-col items-end w-full mt-3 opacity-70 transition-opacity duration-300 hover:opacity-100">
            <span className={`${SECONDARY_METRIC_CLASS} text-right`} style={{ fontSize: 'clamp(10px, 3.5cqi, 13px)' }}>
              {t('stats.todayTotal')}
            </span>
            <div className={`${METRIC_VALUE_CLASS} justify-end`} style={{ fontSize: 'clamp(14px, 5cqi, 20px)' }}>
              <span className="font-semibold text-default-600 tabular-nums leading-none">
                <CountUp end={todayUploadFormatted.val} decimals={todayUploadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="text-default-500/70 uppercase font-medium tracking-widest" style={{ fontSize: 'clamp(9px, 3cqi, 12px)' }}>{todayUploadFormatted.unit}</span>
            </div>
          </div>
        </motion.div>

        {/* Center Chart: Responsive Full Circle Slim Donut with Framer Motion */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="relative flex min-w-0 cursor-default items-center justify-center"
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
              stroke={DOWNLOAD_COLOR}
              strokeWidth="4"
              strokeOpacity="0.38"
            />
            {/* Foreground Ring (Cyan - Upload Ratio) */}
            <motion.circle
              cx="50"
              cy="50"
              r="46"
              fill="transparent"
              stroke={UPLOAD_COLOR}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 46}
              initial={{ strokeDashoffset: 2 * Math.PI * 46 }}
              animate={{ strokeDashoffset: (2 * Math.PI * 46) * (1 - uploadRatio) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              style={{
                filter: isHovered ? `drop-shadow(0px 0px 8px ${UPLOAD_GLOW})` : 'none'
              }}
            />
          </svg>
          
          {/* Centered Text inside Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center z-20">
            <span className="text-default-400 font-semibold tracking-[0.2em] opacity-80 mb-1 whitespace-nowrap" style={{ fontSize: 'clamp(10px, 3cqi, 13px)' }}>
              {t('stats.sessionTotal')}
            </span>
            <div className="flex items-baseline justify-center" style={{ fontSize: 'clamp(22px, 10cqi, 40px)' }}>
              <span className="font-bold font-data-numeric tabular-nums leading-none bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
                <CountUp end={sessionTotalFormatted.val} decimals={sessionTotalFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="font-medium text-default-400/70 ml-2 translate-y-[-1px] uppercase tracking-widest" style={{ fontSize: 'clamp(10px, 3.5cqi, 14px)' }}>
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
          className="flex min-w-0 flex-col items-start"
          style={{ containerType: 'inline-size' }}
        >
          {/* 本次下载 */}
          <div className="flex flex-col items-start w-full">
            <div
              className={`${METRIC_LABEL_CLASS} mb-1.5 justify-start`}
              style={{ backgroundColor: DOWNLOAD_COLOR_SOFT, borderColor: DOWNLOAD_COLOR_BORDER }}
            >
              <IoArrowDown className="shrink-0 text-[clamp(12px,4cqi,16px)]" style={{ color: DOWNLOAD_COLOR }} />
              <span
                className={`${METRIC_LABEL_TEXT_CLASS} text-left`}
                style={{ fontSize: 'clamp(11px, 4cqi, 14px)', color: DOWNLOAD_COLOR }}
              >
                {t('stats.sessionDownload')}
              </span>
            </div>
            <div className={`${METRIC_VALUE_CLASS} justify-start`} style={{ fontSize: 'clamp(18px, 9cqi, 36px)' }}>
              <span 
                className="font-bold font-data-numeric tabular-nums leading-none bg-clip-text text-transparent bg-gradient-to-br from-purple-300 to-purple-600"
              >
                <CountUp end={sessionDownloadFormatted.val} decimals={sessionDownloadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span
                className="font-medium tracking-widest translate-y-[-1px] opacity-70"
                style={{ fontSize: 'clamp(10px, 3.5cqi, 14px)', color: DOWNLOAD_COLOR }}
              >
                {sessionDownloadFormatted.unit}
              </span>
            </div>
          </div>
          
          {/* 今日累计 (下载) */}
          <div className="flex flex-col items-start w-full mt-3 opacity-70 transition-opacity duration-300 hover:opacity-100">
            <span className={`${SECONDARY_METRIC_CLASS} text-left`} style={{ fontSize: 'clamp(10px, 3.5cqi, 13px)' }}>
              {t('stats.todayTotal')}
            </span>
            <div className={`${METRIC_VALUE_CLASS} justify-start`} style={{ fontSize: 'clamp(14px, 5cqi, 20px)' }}>
              <span className="font-semibold text-default-600 tabular-nums leading-none">
                <CountUp end={todayDownloadFormatted.val} decimals={todayDownloadFormatted.val % 1 !== 0 ? 1 : 0} duration={1} preserveValue />
              </span>
              <span className="text-default-500/70 uppercase font-medium tracking-widest" style={{ fontSize: 'clamp(9px, 3cqi, 12px)' }}>{todayDownloadFormatted.unit}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>

  )
}

export default TrafficOverview
