import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import LogDetailModal from '@renderer/components/logs/log-detail-modal'
import EmptyState from '@renderer/components/base/empty-state'
import { useEffect, useMemo, useRef, useState, useDeferredValue } from 'react'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { IoJournalOutline, IoPause, IoPlay } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import { HiOutlineDownload } from 'react-icons/hi'
import { saveFile } from '@renderer/utils/file-ipc'
import { restartCore } from '@renderer/utils/mihomo-ipc'
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

function normalizeLogDaysInput(value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 7
  }

  return Math.min(parsed, 3650)
}

const Logs: React.FC = () => {
  const { t } = useI18n()
  const logs = useLogsStore((state) => state.logs)
  const paused = useLogsStore((state) => state.paused)
  const setPaused = useLogsStore((state) => state.setPaused)
  const clearLogs = useLogsStore((state) => state.clearLogs)

  const [filter, setFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState<(ControllerLog & { time?: string }) | null>(null)

  const { appConfig, patchAppConfig } = useAppConfig()
  const { maxLogDays = 7 } = appConfig || {}
  const [logDaysInput, setLogDaysInput] = useState(maxLogDays.toString())
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const virtuosoRef = useRef<VirtuosoHandle>(null)

  // Use deferred filter to prevent input lagging and reduce frequent re-filters on high volume incoming logs
  const deferredFilter = useDeferredValue(filter)

  const filteredLogs = useMemo(() => {
    if (deferredFilter === '') return logs
    return logs.filter((log) => {
      return (
        includesIgnoreCase(log.payload, deferredFilter) ||
        includesIgnoreCase(log.type, deferredFilter)
      )
    })
  }, [logs, deferredFilter])

  useEffect(() => {
    retainLogsListeners()
    retainLogsView()
    return () => {
      releaseLogsView()
      releaseLogsListeners()
    }
  }, [])

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

  useEffect(() => {
    setLogDaysInput(maxLogDays.toString())
  }, [maxLogDays])

  useEffect(() => {
    if (paused || filteredLogs.length === 0) return
    virtuosoRef.current?.scrollToIndex({
      index: filteredLogs.length - 1,
      behavior: 'smooth',
      align: 'end',
      offset: 0
    })
  }, [filteredLogs, paused])

  return (
    <BasePage title={t('page.logs.title')}>
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      <div className="w-full pb-2 px-2 pt-2">
        <div
          className={`w-full px-2 py-1.5 flex items-center gap-2 ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}
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
                await patchControledMihomoConfig({ 'log-level': v.currentKey as LogLevel })
                await restartCore()
              }}
            >
              <SelectItem key="silent">{t('page.logs.silent')}</SelectItem>
              <SelectItem key="error">{t('page.logs.error')}</SelectItem>
              <SelectItem key="warning">{t('page.logs.warning')}</SelectItem>
              <SelectItem key="info">{t('page.logs.info')}</SelectItem>
              <SelectItem key="debug">{t('page.logs.debug')}</SelectItem>
            </Select>

            <div className="w-1 h-1 rounded-full bg-default-300/50" />

            <div className="flex items-center group relative">
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
                  patchAppConfig({ maxLogDays: val })
                }}
              />
              <span className="text-[10px] text-default-400 pl-0.5">{t('page.logs.days')}</span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-default-200/50" />

          {/* Center: Search Group */}
          <Input
            variant="flat"
            size="sm"
            value={filter}
            placeholder={t('common.search')}
            isClearable
            startContent={<IoJournalOutline className="text-default-400 text-sm" />}
            onValueChange={setFilter}
            className="flex-1"
            classNames={CARD_STYLES.GLASS_INPUT}
          />

          {/* Right: Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              isIconOnly
              title={paused ? t('page.logs.resume') : t('page.logs.pause')}
              className={`min-w-8 w-8 h-8 rounded-full transition-transform active:scale-95 ${paused ? 'text-warning bg-warning/10' : 'text-primary bg-primary/10'}`}
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
              className="min-w-8 w-8 h-8 rounded-full text-default-400 hover:text-danger hover:bg-danger/10 transition-colors"
              variant="light"
              onPress={() => {
                clearLogs()
              }}
            >
              <CgTrash className="text-lg" />
            </Button>

            <Button
              size="sm"
              isIconOnly
              title={t('page.logs.export')}
              className="min-w-8 w-8 h-8 rounded-full text-default-400 hover:text-primary hover:bg-primary/10 transition-colors"
              variant="light"
              isDisabled={filteredLogs.length === 0}
              onPress={handleExportLogs}
            >
              <HiOutlineDownload className="text-lg" />
            </Button>
          </div>
        </div>
      </div>
      <div className="h-[calc(100vh-100px)]">
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
            followOutput={!paused}
            itemContent={(i, log) => {
              return (
                <LogItem
                  index={i}
                  key={log.payload + i}
                  time={log.time}
                  type={log.type}
                  payload={log.payload}
                  onPress={setSelectedLog}
                />
              )
            }}
          />
        )}
      </div>
    </BasePage>
  )
}

export default Logs
