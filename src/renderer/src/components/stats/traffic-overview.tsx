import React from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import { useI18n } from '@renderer/i18n'
import AnimatedNumber from '@renderer/components/base/animated-number'

interface TrafficOverviewProps {
  sessionUpload: number
  sessionDownload: number
  todayUpload: number
  todayDownload: number
  sessionProxy: number
  sessionDirect: number
  weekUpload: number
  weekDownload: number
  monthUpload: number
  monthDownload: number
}

const PROXY_GRADIENT = 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)'
const DIRECT_GRADIENT = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'

interface FormattedTraffic {
  val: number
  unit: string
}

interface PeriodSummaryProps {
  label: string
  upload: number
  download: number
}

interface SplitRatios {
  primary: number
  secondary: number
}

function calculateSplitRatios(primary: number, total: number, minVisible = 1): SplitRatios {
  if (total <= 0) return { primary: 0, secondary: 0 }

  const secondary = Math.max(0, total - primary)
  if (primary <= 0) return { primary: 0, secondary: 100 }
  if (secondary <= 0) return { primary: 100, secondary: 0 }

  const primaryRatio = (primary / total) * 100
  const safePrimary = Math.max(minVisible, Math.min(100 - minVisible, primaryRatio))
  return { primary: safePrimary, secondary: 100 - safePrimary }
}

const PeriodSummary: React.FC<PeriodSummaryProps> = ({ label, upload, download }) => {
  const total = upload + download

  return (
    <div className="min-w-0 rounded-xl border border-default-200/45 bg-default-100/45 px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]">
      <div className="truncate text-[11px] font-medium text-default-500">{label}</div>
      <div className="mt-1 truncate text-sm font-bold leading-tight text-foreground tabular-nums">
        {calcTraffic(total)}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] leading-tight text-default-400 tabular-nums">
        <span className="truncate">↑ {calcTraffic(upload)}</span>
        <span className="truncate">↓ {calcTraffic(download)}</span>
      </div>
    </div>
  )
}

const TrafficOverview: React.FC<TrafficOverviewProps> = ({
  sessionUpload,
  sessionDownload,
  todayUpload,
  todayDownload,
  sessionProxy,
  sessionDirect,
  weekUpload,
  weekDownload,
  monthUpload,
  monthDownload
}) => {
  const { t } = useI18n()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const sessionTotal = sessionUpload + sessionDownload
  const sessionRouteTotal = sessionProxy + sessionDirect

  const formatTraffic = (value: number): FormattedTraffic => {
    const formatted = calcTraffic(value)
    const parts = formatted.split(' ')
    const val = parseFloat(parts[0]) || 0
    const unit = parts[1] || 'B'
    return { val, unit }
  }

  const sessionTotalFormatted = formatTraffic(sessionTotal)

  const sessionRouteRatios = calculateSplitRatios(sessionProxy, sessionRouteTotal)

  return (
    <div className="@container flex h-full w-full flex-col justify-between gap-3">
      {/* Hero: Session Total + Upload / Download */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-default-500">
            {t('stats.sessionTotal')}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-data-numeric text-[32px] font-bold leading-none tracking-tight text-foreground tabular-nums">
              <AnimatedNumber
                end={sessionTotalFormatted.val}
                decimals={sessionTotalFormatted.val % 1 !== 0 ? 1 : 0}
                duration={1}
                preserveValue
              />
            </span>
            <span className="text-xs font-semibold text-default-400">
              {sessionTotalFormatted.unit}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <div
            className="flex items-center gap-1 rounded-lg bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-600 tabular-nums dark:text-cyan-400"
            title={t('stats.upload')}
          >
            <span>↑</span>
            <span>{calcTraffic(sessionUpload)}</span>
          </div>
          <div
            className="flex items-center gap-1 rounded-lg bg-purple-500/10 px-2 py-1 text-xs font-semibold text-purple-600 tabular-nums dark:text-purple-400"
            title={t('stats.download')}
          >
            <span>↓</span>
            <span>{calcTraffic(sessionDownload)}</span>
          </div>
        </div>
      </div>

      {/* Route Distribution */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-default-500">{t('page.profiles.useProxy')}</span>
            <span className="font-semibold text-foreground">{calcTraffic(sessionProxy)}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-default-500">{t('stats.directRoute')}</span>
            <span className="font-semibold text-foreground">{calcTraffic(sessionDirect)}</span>
          </div>
        </div>

        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-default-200/60 dark:bg-white/10">
          {sessionRouteTotal > 0 && (
            <>
              <div
                className="h-full transition-[width] duration-700 ease-out"
                style={{
                  width: mounted ? `${sessionRouteRatios.primary}%` : 0,
                  background: PROXY_GRADIENT
                }}
              />
              <div
                className="h-full transition-[width] duration-700 ease-out"
                style={{
                  width: mounted ? `${sessionRouteRatios.secondary}%` : 0,
                  background: DIRECT_GRADIENT
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Period Summary: 3 Bento Tiles */}
      <div className="grid grid-cols-3 gap-2">
        <PeriodSummary label={t('stats.today')} upload={todayUpload} download={todayDownload} />
        <PeriodSummary label={t('stats.thisWeek')} upload={weekUpload} download={weekDownload} />
        <PeriodSummary label={t('stats.thisMonth')} upload={monthUpload} download={monthDownload} />
      </div>
    </div>
  )
}

export default TrafficOverview
