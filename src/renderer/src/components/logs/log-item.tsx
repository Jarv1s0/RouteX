import { Card, CardBody } from '@heroui/react'
import { useI18n } from '@renderer/i18n'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import {
  formatDisplayLogTime,
  getLogTagBadgeClass,
  getLogTypeBadgeClass,
  getLogTypeMarkerClass,
  parseLogPayload
} from '@renderer/utils/log-styles'
import { renderLogContent } from '@renderer/components/logs/log-highlight'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IoCheckmark, IoCopyOutline, IoFunnelOutline } from 'react-icons/io5'

interface Props extends ControllerLog {
  index: number
  compact?: boolean
  searchQuery?: string
  isRegexSearch?: boolean
  onPress?: (log: ControllerLog & { time?: string }) => void
  onQuickFilter?: (keyword: string) => void
}

const LogItem: React.FC<Props> = (props) => {
  const {
    type,
    payload,
    time,
    shortTime,
    compact = true,
    searchQuery,
    isRegexSearch,
    onPress,
    onQuickFilter
  } = props
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
    }
  }, [])

  const parsed = useMemo(() => parseLogPayload(payload), [payload])
  const displayTime = useMemo(() => formatDisplayLogTime(time, shortTime), [time, shortTime])

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress({ type, payload, time, shortTime })
    }
  }, [onPress, payload, shortTime, time, type])

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const fullLog = `[${time || ''}] [${type.toUpperCase()}] ${payload}`
      navigator.clipboard?.writeText(fullLog)
      setCopied(true)
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    },
    [payload, time, type]
  )

  const handleQuickFilter = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (parsed.quickFilterToken && onQuickFilter) {
        onQuickFilter(parsed.quickFilterToken)
      }
    },
    [onQuickFilter, parsed.quickFilterToken]
  )

  const stopActionBubble = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
  }, [])

  const actionButtons = (
    <div
      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0"
      onPointerDown={stopActionBubble}
      onMouseDown={stopActionBubble}
    >
      {parsed.quickFilterToken && onQuickFilter && (
        <button
          type="button"
          title={t('page.logs.filterByKeyword', { keyword: parsed.quickFilterToken })}
          aria-label={t('page.logs.filterByKeyword', { keyword: parsed.quickFilterToken })}
          onClick={handleQuickFilter}
          className="p-1 rounded-md text-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <IoFunnelOutline className="text-xs" />
        </button>
      )}
      <button
        type="button"
        title={t('common.copy')}
        aria-label={t('common.copy')}
        onClick={handleCopy}
        className={`p-1 rounded-md transition-colors cursor-pointer ${
          copied
            ? 'text-success bg-success/10'
            : 'text-foreground/60 hover:text-primary hover:bg-primary/10'
        }`}
      >
        {copied ? <IoCheckmark className="text-xs" /> : <IoCopyOutline className="text-xs" />}
      </button>
    </div>
  )

  return (
    <div className={compact ? 'px-2 pb-1' : 'px-2 pb-2'}>
      <Card
        as="div"
        isPressable
        shadow="none"
        radius={compact ? 'md' : 'lg'}
        className={`w-full group ${CARD_STYLES.BASE} ${CARD_STYLES.LIST_CARD} data-[pressed=true]:scale-[0.997] data-[pressed=true]:bg-default-200/70 dark:data-[pressed=true]:bg-default-100/44`}
        onPress={handlePress}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${getLogTypeMarkerClass(type)} opacity-60 group-hover:opacity-100 transition-opacity`}
        />

        {compact ? (
          <CardBody className="py-1.5 px-2.5 pl-3.5">
            <div className="flex items-start gap-2 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                <span
                  className={`text-[10px] leading-none font-bold px-1.5 py-0.5 rounded border ${getLogTypeBadgeClass(type, 'list')}`}
                >
                  {type.toUpperCase()}
                </span>
                <span
                  title={time}
                  className="text-foreground/65 text-[10px] font-mono tracking-tight tabular-nums"
                >
                  {displayTime}
                </span>
                {parsed.tag && (
                  <span
                    className={`text-[10px] leading-none font-semibold px-1.5 py-0.5 rounded border ${getLogTagBadgeClass(parsed.tag)}`}
                  >
                    {parsed.tag}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 select-text text-xs font-mono text-foreground/90 break-all line-clamp-2 leading-5">
                {renderLogContent(parsed.rest, searchQuery, isRegexSearch)}
              </div>
              {actionButtons}
            </div>
          </CardBody>
        ) : (
          <CardBody className="py-2 px-3 pl-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getLogTypeBadgeClass(type, 'list')}`}
                >
                  {type.toUpperCase()}
                </span>
                {parsed.tag && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getLogTagBadgeClass(parsed.tag)}`}
                  >
                    {parsed.tag}
                  </span>
                )}
                <span
                  title={time}
                  className="text-foreground/65 text-[10px] font-mono tracking-tight tabular-nums"
                >
                  {time}
                </span>
              </div>
              {actionButtons}
            </div>
            <div className="select-text text-sm font-mono text-foreground/90 break-all line-clamp-2 leading-relaxed">
              {renderLogContent(parsed.rest, searchQuery, isRegexSearch)}
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  )
}

export default memo(LogItem, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.type === nextProps.type &&
    prevProps.payload === nextProps.payload &&
    prevProps.time === nextProps.time &&
    prevProps.shortTime === nextProps.shortTime &&
    prevProps.compact === nextProps.compact &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.isRegexSearch === nextProps.isRegexSearch
  )
})
