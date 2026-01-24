import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import LogDetailModal from '@renderer/components/logs/log-detail-modal'
import EmptyState from '@renderer/components/base/empty-state'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Select, SelectItem } from '@heroui/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { IoLocationSharp, IoJournalOutline, IoPause, IoPlay } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import { HiOutlineDownload } from 'react-icons/hi'
import { saveFile, restartCore } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'


import { includesIgnoreCase } from '@renderer/utils/includes'

const cachedLogs: {
  log: ControllerLog[]
  trigger: ((i: ControllerLog[]) => void) | null
  clean: () => void
} = {
  log: [],
  trigger: null,
  clean(): void {
    this.log = []
    if (this.trigger !== null) {
      this.trigger(this.log)
    }
  }
}

window.electron.ipcRenderer.on('mihomoLogs', (_e, log: ControllerLog) => {
  log.time = new Date().toLocaleString()
  cachedLogs.log.push(log)
  if (cachedLogs.log.length >= 500) {
    cachedLogs.log.shift()
  }
  if (cachedLogs.trigger !== null) {
    cachedLogs.trigger(cachedLogs.log)
  }
})

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<ControllerLog[]>(cachedLogs.log)
  const [filter, setFilter] = useState('')
  const [paused, setPaused] = useState(false)
  const [selectedLog, setSelectedLog] = useState<(ControllerLog & { time?: string }) | null>(null)
  
  const { appConfig, patchAppConfig } = useAppConfig()
  const { maxLogDays = 7 } = appConfig || {}
  const [logDaysInput, setLogDaysInput] = useState(maxLogDays.toString())
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const filteredLogs = useMemo(() => {
    if (filter === '') return logs
    return logs.filter((log) => {
      return includesIgnoreCase(log.payload, filter) || includesIgnoreCase(log.type, filter)
    })
  }, [logs, filter])

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
    if (paused) return
    virtuosoRef.current?.scrollToIndex({
      index: filteredLogs.length - 1,
      behavior: 'smooth',
      align: 'end',
      offset: 0
    })
  }, [filteredLogs, paused])

  useEffect(() => {
    const old = cachedLogs.trigger
    cachedLogs.trigger = (a): void => {
      if (!paused) {
        setLogs([...a])
      }
    }
    return (): void => {
      cachedLogs.trigger = old
    }
  }, [paused])

  return (
    <BasePage title="实时日志">
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
      <div className="w-full pb-2 px-2 pt-2">
        <div className={`w-full px-2 py-1.5 flex items-center gap-2 transition-all duration-300 bg-gradient-to-b from-white/20 to-white/5 dark:from-white/5 dark:to-transparent border border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/20 backdrop-blur-3xl backdrop-saturate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_15px_40px_0_rgba(0,0,0,0.2)] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] ${CARD_STYLES.ROUNDED}`}>
          
          {/* Left: Config Group */}
          <div className="flex items-center gap-2 pl-1">
            <Select
              classNames={CARD_STYLES.GLASS_SELECT}
              popoverProps={{
                classNames: { content: "min-w-[100px]" }
              }}
              listboxProps={{
                itemClasses: {
                  base: "gap-2 px-2 rounded-lg data-[hover=true]:bg-default-100/50",
                  selectedIcon: "w-3 h-3"
                }
              }}
              className="w-[75px]"
              size="sm"
              aria-label="日志等级"
              selectedKeys={new Set([logLevel])}
              disallowEmptySelection={true}
              onSelectionChange={async (v) => {
                await patchControledMihomoConfig({ 'log-level': v.currentKey as LogLevel })
                await restartCore()
              }}
            >
              <SelectItem key="silent">静默</SelectItem>
              <SelectItem key="error">错误</SelectItem>
              <SelectItem key="warning">警告</SelectItem>
              <SelectItem key="info">信息</SelectItem>
              <SelectItem key="debug">调试</SelectItem>
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
                aria-label="保留天数"
                value={logDaysInput}
                onValueChange={setLogDaysInput}
                onBlur={() => {
                  const val = parseInt(logDaysInput) || 7
                  setLogDaysInput(val.toString())
                  patchAppConfig({ maxLogDays: val })
                }}
              />
              <span className="text-[10px] text-default-400 pl-0.5">天</span>
            </div>
          </div>

          <div className="w-[1px] h-4 bg-default-200/50" />

          {/* Center: Search Group */}
          <Input
            variant="flat"
            size="sm"
            value={filter}
            placeholder="搜索..."
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
              title={paused ? "恢复并锁定底部" : "暂停并停止滚动"}
              className={`min-w-8 w-8 h-8 rounded-full transition-transform active:scale-95 ${paused ? 'text-warning bg-warning/10' : 'text-primary bg-primary/10'}`}
              variant="light"
              onPress={() => {
                const next = !paused
                setPaused(next)
                // 如果恢复，立即更新一次
                if (!next) {
                  setLogs([...cachedLogs.log])
                }
              }}
            >
              {paused ? (
                <IoPlay className="text-lg" />
              ) : (
                <IoPause className="text-lg" />
              )}
            </Button>
            
            <Button
              size="sm"
              isIconOnly
              title="清空日志"
              className="min-w-8 w-8 h-8 rounded-full text-default-400 hover:text-danger hover:bg-danger/10 transition-colors"
              variant="light"
              onPress={() => {
                cachedLogs.clean()
              }}
            >
              <CgTrash className="text-lg" />
            </Button>
            
            <Button
              size="sm"
              isIconOnly
              title="导出日志"
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
            title="暂无日志"
            description="日志信息将在这里显示"
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
