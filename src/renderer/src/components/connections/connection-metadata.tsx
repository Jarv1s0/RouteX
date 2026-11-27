import React from 'react'
import { ScrollShadow } from '@heroui/react'
import {
  IoArrowDown,
  IoArrowUp,
  IoPerson,
  IoShieldCheckmark,
  IoEarth,
  IoServer,
  IoCopy
} from 'react-icons/io5'
import { FaNetworkWired } from 'react-icons/fa'
import { clsx } from 'clsx'
import { calcTraffic } from '@renderer/utils/calc'
import { useI18n } from '@renderer/i18n'

interface InfoCardProps {
  icon: React.ReactNode
  label: string
  value?: string
  subValue?: string
  theme?: 'green' | 'purple' | 'orange' | 'blue' | 'cyan' | 'default'
}

const NEUTRAL_CARD =
  'bg-white/95 dark:bg-zinc-900/60 border-default-200/85 dark:border-white/12 hover:bg-white dark:hover:bg-zinc-900/75 hover:border-default-300 dark:hover:border-white/20 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_2px_6px_rgba(0,0,0,0.22)]'

const THEME_MAP = {
  green: {
    icon: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    label: 'text-foreground-500',
    value: 'text-foreground'
  },
  purple: {
    icon: 'bg-purple-500/12 text-purple-600 dark:text-purple-400',
    label: 'text-foreground-500',
    value: 'text-foreground'
  },
  orange: {
    icon: 'bg-warning/12 text-warning',
    label: 'text-foreground-500',
    value: 'text-foreground'
  },
  blue: {
    icon: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
    label: 'text-foreground-500',
    value: 'text-foreground'
  },
  cyan: {
    icon: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400',
    label: 'text-foreground-500',
    value: 'text-foreground'
  },
  default: {
    icon: 'bg-default-100 text-default-500',
    label: 'text-foreground-500',
    value: 'text-foreground'
  }
} as const

const INLINE_SUMMARY_TONE = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning'
} as const

const InlineSummary: React.FC<{
  label: string
  value: string
  tone: 'primary' | 'success' | 'warning'
}> = ({ label, value, tone }) => {
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span
        className={clsx(
          'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
          INLINE_SUMMARY_TONE[tone]
        )}
      >
        {label}
      </span>
      <span
        className="max-w-[110px] truncate text-xs font-medium text-foreground-600"
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, value, subValue, theme = 'default' }) => {
  const t = THEME_MAP[theme]
  const handleCopy = () => {
    if (value) navigator.clipboard.writeText(value)
  }

  return (
    <div
      className={`h-full p-3 rounded-[12px] border transition-colors group relative ${NEUTRAL_CARD}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('p-1.5 rounded-lg text-xs', t.icon)}>{icon}</div>
        <span className={`text-[11px] font-semibold tracking-wide ${t.label}`}>{label}</span>
      </div>
      <span
        className={clsx('text-[13.5px] font-semibold font-mono truncate block pr-6', t.value)}
        title={value}
      >
        {value || 'N/A'}
      </span>
      {subValue && (
        <span className="text-[11px] text-default-400 truncate mt-1 block" title={subValue}>
          {subValue}
        </span>
      )}
      {value && (
        <div
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md text-default-400 hover:text-primary hover:bg-default-100 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          title="Copy"
        >
          <IoCopy className="text-xs" />
        </div>
      )}
    </div>
  )
}

interface Props {
  connection: ControllerConnectionDetail
  sniffSummary: string
  source: string
  destination: string
}

export const ConnectionMetadata: React.FC<Props> = ({
  connection,
  sniffSummary,
  source,
  destination
}) => {
  const { t } = useI18n()

  return (
    <ScrollShadow className="flex-1 min-h-0 p-1.5 flex flex-col gap-1.5">
      <div className={`rounded-[12px] border px-3 py-2 ${NEUTRAL_CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <IoArrowDown className="text-sm shrink-0 text-purple-500" />
              <div className="flex items-baseline leading-none gap-1 font-mono tabular-nums">
                <span className="font-semibold text-[13px] text-foreground">
                  {calcTraffic(connection.download)}
                </span>
                <span className="text-[11px] text-default-400">
                  {calcTraffic(connection.downloadSpeed || 0)}/s
                </span>
              </div>
            </div>
            <div className="h-3.5 w-px shrink-0 bg-default-200/70 dark:bg-white/10" />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <IoArrowUp className="text-sm shrink-0 text-sky-500" />
              <div className="flex items-baseline leading-none gap-1 font-mono tabular-nums">
                <span className="font-semibold text-[13px] text-foreground">
                  {calcTraffic(connection.upload)}
                </span>
                <span className="text-[11px] text-default-400">
                  {calcTraffic(connection.uploadSpeed || 0)}/s
                </span>
              </div>
            </div>
          </div>
          <div className="ml-auto shrink-0">
            <InlineSummary
              label={t('connections.detail.sniff')}
              value={sniffSummary}
              tone="primary"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        {/* 目标地址卡片 */}
        <div
          className={`h-full p-3 rounded-[12px] border transition-colors group relative ${NEUTRAL_CARD}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400">
              <FaNetworkWired className="text-xs" />
            </div>
            <span className="text-[11px] font-semibold text-foreground-500 tracking-wide">
              {t('connections.detail.destination')}
            </span>
          </div>
          <span
            className="text-[13px] font-semibold text-foreground font-mono [overflow-wrap:anywhere] leading-snug block pr-5"
            title={destination}
          >
            {destination}
          </span>
          {(connection.metadata.destinationGeoIP?.length ||
            connection.metadata.destinationIPASN) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {connection.metadata.destinationGeoIP?.length ? (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-default-200/70 bg-default-100/90 text-default-700 dark:border-white/10 dark:bg-white/[0.08] dark:text-default-300">
                  {connection.metadata.destinationGeoIP.join(' ')}
                </span>
              ) : null}
              {connection.metadata.destinationIPASN && (
                <span className="text-[11px] text-default-400">
                  {connection.metadata.destinationIPASN}
                </span>
              )}
            </div>
          )}
          <div
            onClick={() => navigator.clipboard.writeText(destination)}
            className="absolute top-3 right-3 p-1.5 rounded-md text-default-400 hover:text-primary hover:bg-default-100 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-20"
            title="Copy"
          >
            <IoCopy className="text-xs" />
          </div>
        </div>

        {/* 源地址 */}
        <InfoCard
          icon={<IoPerson />}
          label={t('connections.detail.source')}
          value={source}
          subValue={connection.metadata.sourceGeoIP?.join(' ') || 'Local Network'}
          theme="green"
        />
      </div>

      {/* 辅助信息网格 */}
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
        <InfoCard
          icon={<IoShieldCheckmark />}
          label={t('connections.detail.rule')}
          value={connection.rule || 'N/A'}
          subValue={
            connection.rulePayload
              ? t('connections.detail.matchedValue', { value: connection.rulePayload })
              : connection.rule
                ? t('connections.detail.noRulePayload')
                : undefined
          }
          theme="purple"
        />
        <InfoCard
          icon={<IoEarth />}
          label={t('connections.detail.dnsMode')}
          value={connection.metadata.dnsMode}
          subValue={
            connection.metadata.sniffHost ? `Sniffed: ${connection.metadata.sniffHost}` : undefined
          }
          theme="cyan"
        />
      </div>

      {/* 入站详情 — divider 横条布局 */}
      <div className={`rounded-[12px] border overflow-hidden ${NEUTRAL_CARD}`}>
        <div className="flex items-center gap-2 px-3.5 py-2 bg-default-100/70 dark:bg-white/[0.04] border-b border-default-200/75 dark:border-white/10">
          <div className="p-1 rounded-md bg-default-200/70 dark:bg-white/10 text-foreground-500">
            <IoServer className="text-xs" />
          </div>
          <span className="text-[11px] font-semibold text-foreground-500 tracking-wide">
            {t('connections.detail.inbound')}
          </span>
        </div>
        <div className="divide-y divide-default-200/65 dark:divide-white/8">
          {[
            {
              label: t('connections.detail.inboundName'),
              value: connection.metadata.inboundName
            },
            {
              label: t('connections.detail.inboundPort'),
              value: connection.metadata.inboundPort?.toString()
            },
            {
              label: t('connections.detail.inboundIp'),
              value: connection.metadata.inboundIP
            },
            {
              label: t('connections.detail.userId'),
              value: connection.metadata.uid?.toString()
            },
            { label: 'DSCP', value: connection.metadata.dscp?.toString() }
          ]
            .filter((item) => item.value !== undefined && item.value !== '')
            .map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3.5 py-1.5 hover:bg-default-100/60 dark:hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-[11px] text-foreground-500 font-medium w-24 shrink-0">
                  {label}
                </span>
                <span
                  className="text-xs font-mono text-foreground text-right truncate select-all"
                  title={value}
                >
                  {value || '-'}
                </span>
              </div>
            ))}
        </div>
      </div>
    </ScrollShadow>
  )
}
