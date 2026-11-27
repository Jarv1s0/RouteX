import { applyConfigChange } from '@renderer/utils/core-restart'
import { notifyError } from '@renderer/utils/notify'
import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import LogDetailModal from '@renderer/components/logs/log-detail-modal'
import EmptyState from '@renderer/components/base/empty-state'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import {
  IoArrowDown,
  IoCloseCircle,
  IoJournalOutline,
  IoPause,
  IoPlay,
  IoReorderThreeOutline
} from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import { HiOutlineDownload } from 'react-icons/hi'
import { saveFile } from '@renderer/utils/file-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import {
  releaseLogsListeners,
  releaseLogsView,
  retainLogsListeners,
  retainLogsView,
  useLogsStore
} from '@renderer/store/use-logs-store'
import { useI18n } from '@renderer/i18n'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { parseLogPayload } from '@renderer/utils/log-styles'

function normalizeLogDaysInput(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 7
  }

  return Math.min(parsed, 3650)
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  silent: 4
}

const MODULE_FILTERS = ['ALL', 'TCP', 'DNS', 'TUN', 'RULE', 'SNIFFER'] as const
type ModuleFilter = (typeof MODULE_FILTERS)[number]

function matchesLogQuery(log: ControllerLog, query: string, isRegex: boolean): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true

  if (isRegex) {
    try {
      const regex = new RegExp(trimmed, 'i')
      return regex.test(log.payload) || regex.test(log.type)
    } catch {
      return false
    }
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (token.startsWith('-') && token.length > 1) {
      const exclude = token.slice(1)
      if (includesIgnoreCase(log.payload, exclude) || includesIgnoreCase(log.type, exclude)) {
        return false
      }
    } else if (!includesIgnoreCase(log.payload, token) && !includesIgnoreCase(log.type, token)) {
      return false
    }
  }
  return true
}

const Logs: React.FC = () => {
  const { t } = useI18n()
  const logs = useLogsStore((state) => state.logs)
  const paused = useLogsStore((state) => state.paused)
  const setPaused = useLogsStore((state) => state.setPaused)
  const clearLogs = useLogsStore((state) => state.clearLogs)

  const [filter, setFilter] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('ALL')
  const [compact, setCompact] = useState(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedLog, setSelectedLog] = useState<(ControllerLog & { time?: string }) | null>(null)

  const { appConfig, patchAppConfig } = useAppConfig()
  const { maxLogDays = 7 } = appConfig || {}
  const [logDaysInput, setLogDaysInput] = useState(maxLogDays.toString())
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const prevLogIdsRef = useRef<Set<number | string>>(
    new Set(logs.map((log) => log.id ?? String(log.time ?? '') + '-' + log.payload))
  )

  // Use deferred filter to prevent input lagging and reduce frequent re-filters on high volume incoming logs
  const deferredFilter = useDeferredValue(filter)

  const isInvalidRegex = useMemo(() => {
    if (!isRegex || !deferredFilter.trim()) return false
    try {
      new RegExp(deferredFilter.trim(), 'i')
      return false
    } catch {
      return true
    }
  }, [isRegex, deferredFilter])

  const filteredLogs = useMemo(() => {
    if (logLevel === 'silent') return []
    return logs.filter((log) => {
      if (LOG_LEVEL_PRIORITY[log.type] < LOG_LEVEL_PRIORITY[logLevel]) return false
      if (moduleFilter !== 'ALL') {
        const parsed = parseLogPayload(log.payload)
        if (parsed.tag?.toUpperCase() !== moduleFilter) return false
      }
      return matchesLogQuery(log, deferredFilter, isRegex)
    })
  }, [logs, logLevel, moduleFilter, deferredFilter, isRegex])

  useEffect(() => {
    retainLogsListeners()
    retainLogsView()
    return () => {
      releaseLogsView()
      releaseLogsListeners()
    }
  }, [])

  useEffect(() => {
    setLogDaysInput(maxLogDays.toString())
  }, [maxLogDays])

  // Count newly buffered visible logs while the user is away from the bottom.
  useEffect(() => {
    const prevIds = prevLogIdsRef.current
    const nextIds = new Set(logs.map((log) => log.id ?? String(log.time ?? '') + '-' + log.payload))
    const addedIds = new Set([...nextIds].filter((id) => !prevIds.has(id)))
    const addedCount = filteredLogs.filter((log) =>
      addedIds.has(log.id ?? String(log.time ?? '') + '-' + log.payload)
    ).length
    prevLogIdsRef.current = nextIds

    if (isAtBottom || paused) {
      if (isAtBottom) setUnreadCount(0)
      return
    }
    if (addedCount > 0) {
      setUnreadCount((prev) => prev + addedCount)
    }
  }, [logs, filteredLogs, isAtBottom, paused])

  const handleExportLogs = async () => {
    if (filteredLogs.length === 0) {
      return
    }
    const content = filteredLogs
      .map((log) => `[${log.time}] [${log.type.toUpperCase()}] ${log.payload}`)
      .join('\n')
    const defaultName = `routex-logs-${new Date().toISOString().slice(0, 10)}.txt`
    await saveFile(content, defaultName, 'txt')
  }

  const handleScrollToBottom = useCallback(() => {
    if (filteredLogs.length === 0) return
    virtuosoRef.current?.scrollToIndex({
      index: filteredLogs.length - 1,
      behavior: 'smooth',
      align: 'end'
    })
    setIsAtBottom(true)
    setUnreadCount(0)
  }, [filteredLogs.length])

  const handleQuickFilter = useCallback((keyword: string) => {
    setIsRegex(false)
    setFilter(keyword)
  }, [])

  return (
    <BasePage title={t('page.logs.title')}>
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      <div className="h-[calc(100vh-49px)] flex flex-col overflow-hidden">
        <div className="shrink-0 z-40 bg-transparent w-full pb-1.5 px-2 pt-2 flex flex-col gap-1.5">
          <div
            className={`w-full px-2 py-1.5 flex items-center gap-2 ${CARD_STYLES.GLASS_TOOLBAR}`}
          >
            {/* Left: Config Group */}
            <div className="flex items-center gap-2 pl-1">
              <Select
                classNames={CARD_STYLES.GLASS_SELECT}
                popoverProps={{
                  classNames: { content: 'min-w-[100px]' }
                }}
                listboxProps={{
                  itemClasses: {
                    base: 'gap-2 px-2 rounded-lg data-[hover=true]:bg-default-100/50',
                    selectedIcon: 'w-3 h-3'
                  }
                }}
                className="w-[75px]"
                size="sm"
                aria-label={t('page.logs.level')}
                selectedKeys={new Set([logLevel])}
                disallowEmptySelection={true}
                onSelectionChange={async (v) => {
                  try {
                    await applyConfigChange({ core: { 'log-level': v.currentKey as LogLevel } })
                  } catch (error) {
                    notifyError(error)
                  }
                }}
              >
                <SelectItem key="silent">{t('page.logs.silent')}</SelectItem>
                <SelectItem key="error">{t('page.logs.error')}</SelectItem>
                <SelectItem key="warning">{t('page.logs.warning')}</SelectItem>
                <SelectItem key="info">{t('page.logs.info')}</SelectItem>
                <SelectItem key="debug">{t('page.logs.debug')}</SelectItem>
              </Select>

              <div className="w-1 h-1 rounded-full bg-default-300/50" />

              <div
                className="flex items-center gap-1 group relative"
                title={t('page.logs.retentionHint')}
              >
                <span className="text-[10px] text-foreground/65 select-none">
                  {t('page.logs.keep')}
                </span>
                <Input
                  size="sm"
                  type="number"
                  className="w-[42px]"
                  classNames={{
                    ...CARD_STYLES.GLASS_INPUT,
                    input: `${CARD_STYLES.GLASS_INPUT.input} text-center [&::-webkit-inner-spin-button]:appearance-none`
                  }}
                  aria-label={t('page.logs.retentionDays')}
                  min={1}
                  value={logDaysInput}
                  onValueChange={setLogDaysInput}
                  onBlur={() => {
                    const val = normalizeLogDaysInput(logDaysInput)
                    setLogDaysInput(val.toString())
                    patchAppConfig({ maxLogDays: val }).catch((error) => notifyError(error))
                  }}
                />
                <span className="text-[10px] text-foreground/65 select-none">
                  {t('page.logs.days')}
                </span>
              </div>
            </div>

            <div className="w-[1px] h-4 bg-default-200/50" />

            {/* Center: Search Group */}
            <Input
              variant="flat"
              size="sm"
              value={filter}
              placeholder={t('common.search')}
              title={t('page.logs.searchHint')}
              isInvalid={isInvalidRegex}
              startContent={<IoJournalOutline className="text-foreground/60 text-sm shrink-0" />}
              endContent={
                <div className="flex items-center gap-0.5 shrink-0">
                  {filter && (
                    <Button
                      size="sm"
                      isIconOnly
                      variant="light"
                      aria-label="clear input"
                      className="min-w-6 w-6 h-6 rounded-full text-foreground/60 hover:text-foreground"
                      onPress={() => setFilter('')}
                    >
                      <IoCloseCircle className="text-base" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={isRegex ? 'solid' : 'flat'}
                    title={t('page.logs.regexSearch')}
                    aria-label={t('page.logs.regexSearch')}
                    aria-pressed={isRegex}
                    className={`min-w-7 h-6 px-2 rounded-full text-xs font-mono font-semibold transition-all ${
                      isRegex
                        ? 'bg-primary text-primary-foreground border border-primary shadow-sm'
                        : 'bg-default-200/75 dark:bg-default-100/45 text-foreground/80 border border-default-300/60 dark:border-white/15 hover:bg-default-300/80 hover:text-foreground'
                    }`}
                    onPress={() => setIsRegex((prev) => !prev)}
                  >
                    .*
                  </Button>
                </div>
              }
              onValueChange={setFilter}
              className="flex-1 min-w-0"
              classNames={{
                ...CARD_STYLES.GLASS_INPUT,
                inputWrapper: `${CARD_STYLES.GLASS_INPUT.inputWrapper} pr-1`
              }}
            />

            {/* Right: Actions Group */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                isIconOnly
                title={t('page.logs.compactMode')}
                aria-label={t('page.logs.compactMode')}
                aria-pressed={compact}
                className={`min-w-8 w-8 h-8 ${CARD_STYLES.GLASS_TOOLBAR_BUTTON} transition-colors ${
                  compact
                    ? 'text-primary bg-primary/10'
                    : 'text-foreground/70 hover:text-foreground'
                }`}
                variant="light"
                onPress={() => setCompact((prev) => !prev)}
              >
                <IoReorderThreeOutline className="text-lg" />
              </Button>

              <Button
                size="sm"
                isIconOnly
                title={paused ? t('page.logs.resume') : t('page.logs.pause')}
                className={`min-w-8 w-8 h-8 ${CARD_STYLES.GLASS_TOOLBAR_BUTTON} transition-transform active:scale-95 ${paused ? 'text-warning bg-warning/10' : 'text-primary bg-primary/10'}`}
                variant="light"
                onPress={() => {
                  setPaused(!paused)
                }}
              >
                {paused ? <IoPlay className="text-lg" /> : <IoPause className="text-lg" />}
              </Button>

              <Button
                size="sm"
                isIconOnly
                title={t('page.logs.clear')}
                className={`min-w-8 w-8 h-8 ${CARD_STYLES.GLASS_TOOLBAR_BUTTON} text-foreground/70 hover:text-danger hover:bg-danger/10 transition-colors`}
                variant="light"
                onPress={() => {
                  clearLogs()
                  setUnreadCount(0)
                }}
              >
                <CgTrash className="text-lg" />
              </Button>

              <Button
                size="sm"
                isIconOnly
                title={t('page.logs.export')}
                className={`min-w-8 w-8 h-8 ${CARD_STYLES.GLASS_TOOLBAR_BUTTON} text-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors`}
                variant="light"
                isDisabled={filteredLogs.length === 0}
                onPress={handleExportLogs}
              >
                <HiOutlineDownload className="text-lg" />
              </Button>
            </div>
          </div>

          {/* Module quick filters & status count */}
          <div className="flex items-center justify-between px-1 gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {MODULE_FILTERS.map((mod) => {
                const active = moduleFilter === mod
                return (
                  <button
                    key={mod}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setModuleFilter(mod)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${
                      active
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-default-100/60 dark:bg-default-100/20 text-foreground/75 border-transparent hover:text-foreground hover:bg-default-200/60'
                    }`}
                  >
                    {mod === 'ALL' ? t('page.logs.allModules') : mod}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-foreground/65 tabular-nums">
              {paused && (
                <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning font-sans text-[10px] font-medium">
                  {t('page.logs.pausedBadge')}
                </span>
              )}
              <span>
                {filteredLogs.length} / {logs.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={<IoJournalOutline />}
              title={t('page.logs.emptyTitle')}
              description={t('page.logs.emptyDescription')}
            />
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              data={filteredLogs}
              initialTopMostItemIndex={filteredLogs.length - 1}
              followOutput={!paused && isAtBottom ? 'smooth' : false}
              atBottomStateChange={(atBottom) => {
                setIsAtBottom(atBottom)
                if (atBottom) setUnreadCount(0)
              }}
              itemContent={(i, log) => {
                return (
                  <LogItem
                    index={i}
                    id={log.id}
                    key={log.id ?? `${log.time ?? ''}-${log.payload}-${i}`}
                    time={log.time}
                    shortTime={log.shortTime}
                    type={log.type}
                    payload={log.payload}
                    compact={compact}
                    searchQuery={deferredFilter}
                    isRegexSearch={isRegex}
                    onPress={setSelectedLog}
                    onQuickFilter={handleQuickFilter}
                  />
                )
              }}
            />
          )}

          {!isAtBottom && filteredLogs.length > 0 && (
            <div className="absolute bottom-4 right-4 z-30">
              <Button
                size="sm"
                color="primary"
                variant="shadow"
                startContent={<IoArrowDown className="text-sm" />}
                className="h-8 px-3 rounded-full text-xs font-medium"
                onPress={handleScrollToBottom}
              >
                {unreadCount > 0
                  ? `${t('page.logs.newLogsCount', { count: unreadCount })} · ${t('page.logs.scrollToBottom')}`
                  : t('page.logs.scrollToBottom')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </BasePage>
  )
}

export default Logs
