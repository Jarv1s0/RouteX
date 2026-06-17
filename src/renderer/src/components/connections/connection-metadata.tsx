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
  'bg-default-50/60 dark:bg-content1/10 border-default-200/50 dark:border-white/5 hover:border-default-300/60'

const THEME_MAP = {
  green: {
    icon: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    label: 'text-emerald-700/70 dark:text-emerald-300/75',
    value: 'text-foreground'
  },
  purple: {
    icon: 'bg-purple-500/15 text-purple-500',
    label: 'text-purple-500/80',
    value: 'text-purple-500'
  },
  orange: {
    icon: 'bg-warning/15 text-warning',
    label: 'text-warning/80',
    value: 'text-foreground'
  },
  blue: {
    icon: 'bg-blue-500/15 text-blue-500',
    label: 'text-blue-500/80',
    value: 'text-foreground'
  },
  cyan: {
    icon: 'bg-cyan-500/15 text-cyan-500',
    label: 'text-cyan-500/80',
    value: 'text-foreground'
  },
  default: {
    icon: 'bg-default-100 text-default-500',
    label: 'text-default-500',
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
    <div className="flex items-center gap-2 rounded-xl border border-default-200/60 bg-default-100/60 px-2.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <span
        className={clsx(
          'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
          INLINE_SUMMARY_TONE[tone]
        )}
      >
        {label}
      </span>
      <span className="max-w-[72px] truncate text-xs font-semibold text-foreground" title={value}>
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
      className={`h-full p-4 rounded-xl backdrop-blur-md border shadow-sm transition-colors group relative ${NEUTRAL_CARD}`}
    >
      <div className="flex items-center gap-2.5 mb-2 opacity-80 group-hover:opacity-100 transition-opacity">
        <div className={clsx('p-1.5 rounded-lg text-sm', t.icon)}>{icon}</div>
        <span className={`text-xs font-bold uppercase tracking-wide ${t.label}`}>{label}</span>
      </div>
      <span
        className={clsx('text-sm font-bold font-mono truncate block pr-6', t.value)}
        title={value}
      >
        {value || 'N/A'}
      </span>
      {subValue && (
        <span className="text-xs text-default-400 truncate mt-0.5 block" title={subValue}>
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
    <ScrollShadow className="flex-1 p-2 pr-2 flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl bg-default-50/60 dark:bg-content1/10 backdrop-blur-md border border-default-200/50 dark:border-white/5 shadow-sm px-4 py-2">
        <div className="flex min-w-max items-center justify-between gap-6 whitespace-nowrap">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <IoArrowDown className="text-lg text-[#c084fc]" />
              <div className="flex items-center leading-none gap-2">
                <span className="font-mono font-bold text-sm text-foreground">
                  {calcTraffic(connection.download)}
                </span>
                <span className="text-[10px] text-default-400 font-mono">
                  {calcTraffic(connection.downloadSpeed || 0)}/s
                </span>
              </div>
            </div>
            <div className="h-4 w-px bg-default-300/30" />
            <div className="flex items-center gap-2">
              <div className="flex items-center leading-none gap-2">
                <span className="font-mono font-bold text-sm text-foreground">
                  {calcTraffic(connection.upload)}
                </span>
                <span className="text-[10px] text-default-400 font-mono">
                  {calcTraffic(connection.uploadSpeed || 0)}/s
                </span>
              </div>
              <IoArrowUp className="text-lg text-[#22d3ee]" />
            </div>
          </div>
          <div className="ml-auto">
            <InlineSummary
              label={t('connections.detail.sniff')}
              value={sniffSummary}
              tone="primary"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {/* 目标地址卡片 */}
        <div className="h-full p-4 rounded-xl bg-default-50/60 dark:bg-content1/10 backdrop-blur-md border border-default-200/50 dark:border-white/5 shadow-sm hover:border-default-300/60 transition-colors group relative">
          <div className="flex items-center gap-2.5 mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
            <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-500">
              <FaNetworkWired className="text-sm" />
            </div>
            <span className="text-xs font-bold text-blue-500/80 uppercase tracking-wide">
              {t('connections.detail.destination')}
            </span>
          </div>
          <span className="text-base font-bold text-foreground font-mono break-all leading-tight block pr-6">
            {destination}
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            {connection.metadata.destinationGeoIP && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-default-100 text-default-600 border border-default-200/50">
                {connection.metadata.destinationGeoIP}
              </span>
            )}
            {connection.metadata.destinationIPASN && (
              <span className="text-[10px] text-default-400">
                {connection.metadata.destinationIPASN}
              </span>
            )}
          </div>
          <div
            onClick={() => navigator.clipboard.writeText(destination)}
            className="absolute top-3 right-3 p-1.5 rounded-md text-default-400 hover:text-primary hover:bg-default-100 opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-20"
            title="Copy"
          >
            <IoCopy className="text-xs" />
          </div>
        </div>

        {/* 源地址 — 绿色主题 */}
        <InfoCard
          icon={<IoPerson />}
          label={t('connections.detail.source')}
          value={source}
          subValue={connection.metadata.sourceGeoIP?.join(' ') || 'Local Network'}
          theme="green"
        />
      </div>

      {/* 辅助信息网格 */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
      <div className="rounded-xl bg-default-50/60 dark:bg-content1/10 backdrop-blur-md border border-default-200/50 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/5 border-b border-default-200/50 dark:border-white/5">
          <div className="p-1 rounded-md bg-secondary/15 text-secondary">
            <IoServer className="text-sm" />
          </div>
          <span className="text-xs font-bold text-secondary/80 uppercase tracking-wide">
            {t('connections.detail.inbound')}
          </span>
        </div>
        <div className="divide-y divide-default-200/40 dark:divide-white/5">
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
                className="flex items-center justify-between px-4 py-2 hover:bg-default-100/50 transition-colors"
              >
                <span className="text-xs text-default-400 font-medium w-24 shrink-0">{label}</span>
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
