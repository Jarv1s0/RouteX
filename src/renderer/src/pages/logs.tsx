import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import LogDetailModal from '@renderer/components/logs/log-detail-modal'
import EmptyState from '@renderer/components/base/empty-state'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Divider, Input, Select, SelectItem } from '@heroui/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { IoLocationSharp, IoJournalOutline } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'
import { HiOutlineDownload } from 'react-icons/hi'
import { saveFile, restartCore } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { primaryNumberInputClassNames } from '@renderer/components/settings/advanced-settings'

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
  const [trace, setTrace] = useState(true)
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
    if (!trace) return
    virtuosoRef.current?.scrollToIndex({
      index: filteredLogs.length - 1,
      behavior: 'smooth',
      align: 'end',
      offset: 0
    })
  }, [filteredLogs, trace])

  useEffect(() => {
    const old = cachedLogs.trigger
    cachedLogs.trigger = (a): void => {
      setLogs([...a])
    }
    return (): void => {
      cachedLogs.trigger = old
    }
  }, [])

  return (
    <BasePage title="实时日志">
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
      <div className="sticky top-0 z-40">
        <div className="w-full flex p-2 items-center">
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[90px]"
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
          <Input
            size="sm"
            type="number"
            className="w-[60px] ml-2"
            classNames={primaryNumberInputClassNames}
            aria-label="保留天数"
            value={logDaysInput}
            onValueChange={setLogDaysInput}
            onBlur={() => {
              const val = parseInt(logDaysInput) || 7
              setLogDaysInput(val.toString())
              patchAppConfig({ maxLogDays: val })
            }}
            endContent={<span className="text-xs text-foreground-400">天</span>}
          />
          <Input
            variant="flat"
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
            className="flex-1 ml-2"
          />
          <Button
            size="sm"
            isIconOnly
            className="ml-2"
            color={trace ? 'primary' : 'default'}
            variant={trace ? 'solid' : 'bordered'}
            onPress={() => {
              setTrace((prev) => !prev)
            }}
          >
            <IoLocationSharp className="text-lg" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            title="清空日志"
            className="ml-2"
            variant="flat"
            color="danger"
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
            className="ml-2"
            variant="flat"
            color="primary"
            isDisabled={filteredLogs.length === 0}
            onPress={handleExportLogs}
          >
            <HiOutlineDownload className="text-lg" />
          </Button>
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-px">
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
            followOutput={trace}
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
