import { Button, Card } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { memo, useCallback, useMemo } from 'react'
import type { PressEvent } from '@react-types/shared'
import { CgClose, CgTrash } from 'react-icons/cg'
import { IoEyeOff, IoEye, IoArrowUp, IoArrowDown } from 'react-icons/io5'
import { getFlag, cleanNodeName } from '@renderer/utils/flags'
import { useI18n } from '@renderer/i18n'
import MihomoIcon from '@renderer/components/base/mihomo-icon'
import { isMihomoProcessPath } from '@renderer/utils/mihomo-process'

const SELECTED_CARD_CLASS =
  'bg-primary/[0.08] dark:bg-primary/[0.14] border border-primary/30 dark:border-primary/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_14px_rgba(0,111,238,0.1)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_rgba(0,111,238,0.18)]'

const DEFAULT_CARD_CLASS =
  'bg-white/65 dark:bg-default-50/35 border border-default-200/70 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.2)] hover:bg-white/85 dark:hover:bg-default-100/45 hover:border-default-300/80 dark:hover:border-white/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_14px_rgba(0,0,0,0.35)] transition-[background-color,border-color,box-shadow] duration-200'

const NODE_BADGE_BASE_CLASS = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border'

function getNodeBadgeClass(chainName?: string): string {
  const normalized = (chainName || '').trim().toUpperCase()
  if (normalized === 'DIRECT') {
    return `${NODE_BADGE_BASE_CLASS} border-default-200/80 dark:border-white/10 bg-default-100/70 dark:bg-white/[0.05] text-foreground-500 dark:text-foreground-400`
  }
  if (normalized === 'REJECT' || normalized === 'REJECT-DROP') {
    return `${NODE_BADGE_BASE_CLASS} border-danger/20 bg-danger/[0.07] text-danger`
  }
  return `${NODE_BADGE_BASE_CLASS} border-primary/20 bg-primary/[0.07] text-primary dark:text-primary-400`
}
const connectionItemStartTimeCache = new WeakMap<ControllerConnectionDetail, number>()

function getConnectionItemStartTime(info: ControllerConnectionDetail): number {
  const cached = connectionItemStartTimeCache.get(info)
  if (cached !== undefined) return cached

  const next = Date.parse(info.start || '') || 0
  connectionItemStartTimeCache.set(info, next)
  return next
}

function formatCompactDurationFromStartMs(startMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

function getConnectionItemRenderKey(info: ControllerConnectionDetail): string {
  const metadata = info.metadata
  return [
    metadata.process,
    metadata.processPath,
    metadata.host,
    metadata.destinationIP,
    metadata.remoteDestination,
    metadata.sourceIP,
    metadata.type,
    metadata.network,
    info.chains?.[0],
    info.rule,
    info.rulePayload
  ].join('|')
}

interface Props {
  index: number
  info: ControllerConnectionDetail
  displayIcon?: boolean
  iconUrl?: string
  displayName?: string
  selectedId?: string
  setSelected?: React.Dispatch<React.SetStateAction<ControllerConnectionDetail | undefined>>
  setIsDetailModalOpen?: React.Dispatch<React.SetStateAction<boolean>>
  close?: (id: string) => void
  hide?: (id: string) => void
  unhide?: (id: string) => void
  isHidden?: boolean
  timeRefreshTrigger?: number
  onContextMenu?: (conn: ControllerConnectionDetail, event: React.MouseEvent) => void
}

const ConnectionItemComponent: React.FC<Props> = ({
  info,
  displayIcon,
  iconUrl,
  displayName,
  selectedId,
  setSelected,
  setIsDetailModalOpen,
  close,
  hide,
  unhide,
  isHidden,
  timeRefreshTrigger,
  onContextMenu
}) => {
  const { t } = useI18n()
  const isSelected = info.id === selectedId
  const processName =
    displayName || info.metadata.process?.replace(/\.exe$/, '') || info.metadata.sourceIP || '-'
  const destination =
    info.metadata.host || info.metadata.destinationIP || info.metadata.remoteDestination || '-'
  const useMihomoIcon =
    displayIcon &&
    (isMihomoProcessPath(info.metadata.processPath) || isMihomoProcessPath(info.metadata.process))

  const timeAgo = useMemo(() => {
    return formatCompactDurationFromStartMs(getConnectionItemStartTime(info))
  }, [info, timeRefreshTrigger])

  const uploadSpeed = useMemo(() => calcTraffic(info.uploadSpeed || 0), [info.uploadSpeed])
  const downloadSpeed = useMemo(() => calcTraffic(info.downloadSpeed || 0), [info.downloadSpeed])
  const uploadTotal = useMemo(() => calcTraffic(info.upload || 0), [info.upload])
  const downloadTotal = useMemo(() => calcTraffic(info.download || 0), [info.download])
  const hasSpeed = (info.uploadSpeed || 0) > 0 || (info.downloadSpeed || 0) > 0
  const hasTraffic = (info.upload || 0) > 0 || (info.download || 0) > 0

  const handleCardPress = useCallback(() => {
    setSelected?.(info)
    setIsDetailModalOpen?.(true)
  }, [setSelected, setIsDetailModalOpen, info])

  const handleClose = useCallback(
    (_e: PressEvent) => {
      close?.(info.id)
    },
    [close, info.id]
  )

  const handleHide = useCallback(
    (_e: PressEvent) => {
      const id = info.id
      if (isHidden) {
        unhide?.(id)
      } else {
        hide?.(id)
      }
    },
    [isHidden, hide, unhide, info.id]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu?.(info, e)
    },
    [onContextMenu, info]
  )

  return (
    <div className="px-2.5 pb-1.5" onContextMenu={handleContextMenu}>
      <Card
        as="div"
        isPressable
        shadow="none"
        className={`w-full group ${CARD_STYLES.BASE}
          ${isSelected ? SELECTED_CARD_CLASS : DEFAULT_CARD_CLASS}
          data-[pressed=true]:scale-[0.995]
        `}
        radius="lg"
        onPress={handleCardPress}
      >
        <div className="w-full flex items-center py-2.5 px-3.5 gap-3">
          {displayIcon && (
            <div className="w-8 h-8 rounded-full bg-default-200/45 dark:bg-white/[0.07] flex items-center justify-center shrink-0">
              {useMihomoIcon ? (
                <MihomoIcon className="w-4.5 h-4.5 text-default-500" />
              ) : iconUrl ? (
                <img src={iconUrl} className="w-4.5 h-4.5 object-contain" alt="" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-default-300/80" />
              )}
            </div>
          )}

          {/* Left: Process/Destination & Protocol/Node */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {/* Header Row */}
            <div className="flex items-center gap-1.5 text-[13px] min-w-0">
              <span className="font-semibold text-foreground-800 dark:text-foreground-900 flex items-center gap-1.5 shrink-0 max-w-[40%] truncate">
                <span className="truncate">{processName}</span>
                {isHidden && (
                  <IoEyeOff
                    className="text-[12px] text-default-400 shrink-0"
                    title={t('connections.hiddenTitle')}
                  />
                )}
              </span>
              <span className="text-foreground-400 text-[11px] shrink-0">→</span>
              <span className="text-foreground-500 dark:text-foreground-400 truncate font-mono text-[12.5px]">
                {destination}
              </span>
            </div>

            {/* Meta Row - Clean inline protocol + semantic node badge */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground-500 shrink-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    !info.isActive
                      ? 'bg-danger shadow-sm shadow-danger/50'
                      : info.metadata.type === 'Inner'
                        ? 'bg-warning shadow-sm shadow-warning/50'
                        : info.metadata.type === 'Tun'
                          ? 'bg-primary shadow-sm shadow-primary/50'
                          : 'bg-default-400'
                  }`}
                />
                <span>
                  {info.metadata.type}·{info.metadata.network.toUpperCase()}
                </span>
              </span>

              <span className="text-foreground-300 text-[10px] shrink-0">•</span>

              <div className={`${getNodeBadgeClass(info.chains[0])} min-w-0 max-w-full`}>
                {getFlag(info.chains[0]) && (
                  <span className="flag-emoji text-[12px] leading-none shrink-0">
                    {getFlag(info.chains[0])}
                  </span>
                )}
                <span className="text-[11px] leading-4 font-medium truncate">
                  {cleanNodeName(info.chains[0])}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Duration / Actions & Live Speed / Traffic */}
          <div className="flex flex-col items-end justify-between self-stretch shrink-0 min-w-[100px] gap-1.5">
            <div className="flex items-center justify-end relative h-6 w-full group/actions">
              <span
                className={`font-mono text-[11px] text-foreground-400 tabular-nums transition-opacity duration-150 ${isHidden ? 'opacity-0' : 'group-hover:opacity-0'}`}
              >
                {timeAgo}
              </span>

              <div
                className={`absolute right-0 top-0 flex items-center justify-end gap-1 transition-all duration-200 ${isHidden ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0'}`}
              >
                {(hide || unhide) && (
                  <Button
                    color={isHidden ? 'primary' : 'default'}
                    variant={isHidden ? 'solid' : 'flat'}
                    isIconOnly
                    size="sm"
                    className={`h-6 w-6 min-w-[24px] transition-all ${isHidden ? 'shadow-lg shadow-primary/40' : 'bg-default-100 hover:bg-default-200 text-default-500'}`}
                    onPress={handleHide}
                    title={
                      isHidden ? t('connections.unhideConnection') : t('connections.hideConnection')
                    }
                  >
                    {isHidden ? (
                      <IoEye className="text-[13px]" />
                    ) : (
                      <IoEyeOff className="text-[13px]" />
                    )}
                  </Button>
                )}
                <Button
                  color={info.isActive ? 'warning' : 'danger'}
                  variant="flat"
                  isIconOnly
                  size="sm"
                  className={`h-6 w-6 min-w-[24px] ${info.isActive ? 'bg-warning/10 text-warning hover:bg-warning/20' : 'bg-danger/10 text-danger hover:bg-danger/20'} ${isHidden ? 'hidden group-hover/actions:flex' : ''}`}
                  onPress={handleClose}
                >
                  {info.isActive ? (
                    <CgClose className="text-[13px]" />
                  ) : (
                    <CgTrash className="text-[13px]" />
                  )}
                </Button>
              </div>
            </div>

            {/* Speed or Total Traffic */}
            {(hasSpeed || hasTraffic) && (
              <div className="flex items-center gap-2 text-[11px] font-data-numeric tabular-nums">
                <span
                  className={`inline-flex items-center gap-0.5 ${
                    hasSpeed ? 'text-sky-500 font-medium' : 'text-foreground-400'
                  }`}
                >
                  <IoArrowUp className="text-[10px] opacity-80" />
                  <span>{hasSpeed ? `${uploadSpeed || '0 B'}/s` : uploadTotal || '0 B'}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-0.5 ${
                    hasSpeed ? 'text-purple-500 font-medium' : 'text-foreground-400'
                  }`}
                >
                  <IoArrowDown className="text-[10px] opacity-80" />
                  <span>{hasSpeed ? `${downloadSpeed || '0 B'}/s` : downloadTotal || '0 B'}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

const ConnectionItem = memo(ConnectionItemComponent, (prevProps, nextProps) => {
  const wasSelected = prevProps.selectedId === prevProps.info.id
  const isSelected = nextProps.selectedId === nextProps.info.id

  return (
    prevProps.info.id === nextProps.info.id &&
    prevProps.info.upload === nextProps.info.upload &&
    prevProps.info.download === nextProps.info.download &&
    prevProps.info.uploadSpeed === nextProps.info.uploadSpeed &&
    prevProps.info.downloadSpeed === nextProps.info.downloadSpeed &&
    prevProps.info.isActive === nextProps.info.isActive &&
    getConnectionItemRenderKey(prevProps.info) === getConnectionItemRenderKey(nextProps.info) &&
    prevProps.iconUrl === nextProps.iconUrl &&
    prevProps.displayIcon === nextProps.displayIcon &&
    prevProps.displayName === nextProps.displayName &&
    wasSelected === isSelected &&
    prevProps.isHidden === nextProps.isHidden &&
    prevProps.timeRefreshTrigger === nextProps.timeRefreshTrigger
  )
})

export default ConnectionItem
