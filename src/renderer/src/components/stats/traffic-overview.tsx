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

const PROXY_GRADIENT = 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)'
const DIRECT_GRADIENT = 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)'
const SECTION_LABEL_CLASS =
  'text-[9px] font-medium uppercase leading-none tracking-[0.12em] text-default-500'

interface FormattedTraffic {
  val: number
  unit: string
}

interface DetailMetricProps {
  label: string
  value: FormattedTraffic
  marker: React.ReactNode
}

interface PeriodSummaryProps {
  label: string
  upload: number
  download: number
  uploadGradient: string
  downloadGradient: string
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

const DetailMetric: React.FC<DetailMetricProps> = ({ label, value, marker }) => {
  return (
    <div className="flex items-center gap-1.5 w-auto min-w-[110px] shrink-0">
      <div className="flex items-center gap-1 text-[11px] leading-none font-medium text-default-500 uppercase tracking-wide shrink-0">
        {marker}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-0.5 leading-none tabular-nums">
        <span className="text-sm leading-none font-semibold text-foreground/90 whitespace-nowrap">
          <AnimatedNumber
            end={value.val}
            decimals={value.val % 1 !== 0 ? 1 : 0}
            duration={1}
            preserveValue
          />
        </span>
        <span className="text-[10px] leading-none font-bold text-default-400 shrink-0 whitespace-nowrap">
          {value.unit}
        </span>
      </div>
    </div>
  )
}

const PeriodSummary: React.FC<PeriodSummaryProps> = ({
  label,
  upload,
  download,
  uploadGradient,
  downloadGradient
}) => {
  const total = upload + download
  const formattedTotal = calcTraffic(total)
  const ratios = calculateSplitRatios(upload, total, 2)

  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <div className={`mb-1.5 truncate ${SECTION_LABEL_CLASS}`}>{label}</div>
      <div className="mb-2 text-[13px] font-semibold leading-none text-foreground/85 tabular-nums">
        {formattedTotal}
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-default-100/60">
        {total > 0 ? (
          <>
            {upload > 0 && (
              <div
                className="h-full"
                style={{ width: `${ratios.primary}%`, background: uploadGradient }}
              />
            )}
            {download > 0 && (
              <div
                className="h-full"
                style={{ width: `${ratios.secondary}%`, background: downloadGradient }}
              />
            )}
          </>
        ) : (
          <div className="h-full w-full bg-default-200/50" />
        )}
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

  const formatTraffic = (value: number) => {
    const formatted = calcTraffic(value)
    const parts = formatted.split(' ')
    const val = parseFloat(parts[0]) || 0
    const unit = parts[1] || 'B'
    return { val, unit }
  }

  const sessionTotalFormatted = formatTraffic(sessionTotal)
  const sessionUploadFormatted = formatTraffic(sessionUpload)
  const sessionDownloadFormatted = formatTraffic(sessionDownload)
  const sessionProxyFormatted = formatTraffic(sessionProxy)
  const sessionDirectFormatted = formatTraffic(sessionDirect)

  const sessionRouteRatios = calculateSplitRatios(sessionProxy, sessionRouteTotal)
  const sessionTransferRatios = calculateSplitRatios(sessionUpload, sessionTotal)

  const UPLOAD_GRADIENT = 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)'
  const DOWNLOAD_GRADIENT = 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)'

  return (
    <div className="w-full flex flex-col px-1 pt-0 pb-1 gap-6">
      {/* Transfer Block */}
      <div className="flex flex-col gap-3 animate-fade-in-up">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <div className={`mb-1 ${SECTION_LABEL_CLASS}`}>
              {t('stats.sessionTotal')}
            </div>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="font-data-numeric text-[34px] font-bold leading-none tracking-normal text-foreground tabular-nums">
                <AnimatedNumber
                  end={sessionTotalFormatted.val}
                  decimals={sessionTotalFormatted.val % 1 !== 0 ? 1 : 0}
                  duration={1}
                  preserveValue
                />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-default-400">
                {sessionTotalFormatted.unit}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pb-2 shrink-0">
            <DetailMetric
              label={t('stats.upload')}
              value={sessionUploadFormatted}
              marker={<span className="font-sans text-sky-500 font-bold">↑</span>}
            />
            <DetailMetric
              label={t('stats.download')}
              value={sessionDownloadFormatted}
              marker={<span className="font-sans text-purple-500 font-bold">↓</span>}
            />
          </div>
        </div>

        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-default-100/60">
          {sessionTotal > 0 ? (
            <>
              <div
                className="h-full transition-[width] duration-1000 ease-out"
                style={{ width: mounted ? `${sessionTransferRatios.primary}%` : 0, background: UPLOAD_GRADIENT }}
              />
              <div
                className="h-full transition-[width] duration-1000 ease-out"
                style={{ width: mounted ? `${sessionTransferRatios.secondary}%` : 0, background: DOWNLOAD_GRADIENT }}
              />
            </>
          ) : (
            <div className="h-full w-full bg-default-200/50" />
          )}
        </div>
      </div>

      {/* Route Distribution Block */}
      <div
        className="flex flex-col gap-3 animate-fade-in-up"
        style={{ animationDelay: '100ms' }}
      >
        <div className="flex justify-between items-end">
          <div className={`pb-2 ${SECTION_LABEL_CLASS}`}>
            {t('stats.routeDistribution')}
          </div>
          <div className="flex items-center justify-end gap-4 pb-2 shrink-0">
            <DetailMetric
              label={t('page.profiles.useProxy')}
              value={sessionProxyFormatted}
              marker={
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.35)]" />
              }
            />
            <DetailMetric
              label={t('stats.directRoute')}
              value={sessionDirectFormatted}
              marker={
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.35)]" />
              }
            />
          </div>
        </div>

        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-default-100/60">
          {sessionRouteTotal > 0 ? (
            <>
              <div
                className="h-full transition-[width] duration-1000 ease-out"
                style={{ width: mounted ? `${sessionRouteRatios.primary}%` : 0, background: PROXY_GRADIENT }}
              />
              <div
                className="h-full transition-[width] duration-1000 ease-out"
                style={{ width: mounted ? `${sessionRouteRatios.secondary}%` : 0, background: DIRECT_GRADIENT }}
              />
            </>
          ) : (
            <div className="h-full w-full bg-default-200/50" />
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-3 divide-x divide-default-100/60 pt-1 animate-fade-in-up"
        style={{ animationDelay: '180ms' }}
      >
        <PeriodSummary
          label={t('stats.today')}
          upload={todayUpload}
          download={todayDownload}
          uploadGradient={UPLOAD_GRADIENT}
          downloadGradient={DOWNLOAD_GRADIENT}
        />
        <PeriodSummary
          label={t('stats.thisWeek')}
          upload={weekUpload}
          download={weekDownload}
          uploadGradient={UPLOAD_GRADIENT}
          downloadGradient={DOWNLOAD_GRADIENT}
        />
        <PeriodSummary
          label={t('stats.thisMonth')}
          upload={monthUpload}
          download={monthDownload}
          uploadGradient={UPLOAD_GRADIENT}
          downloadGradient={DOWNLOAD_GRADIENT}
        />
      </div>
    </div>
  )
}

export default TrafficOverview
