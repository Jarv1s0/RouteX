import { useEffect, useMemo, useState } from 'react'
import { Accordion, AccordionItem, Button, Chip, ScrollShadow, Switch } from '@heroui/react'
import { IoCheckmarkCircle, IoClose, IoRefresh } from 'react-icons/io5'
import { useAppConfig } from './hooks/use-app-config'
import { useControledMihomoConfig } from './hooks/use-controled-mihomo-config'
import { useGroups } from './hooks/use-groups'
import { platform } from './utils/init'
import { quitApp } from './utils/app-ipc'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  patchControledMihomoConfig,
  patchMihomoConfig,
  restartCore,
  subscribeDesktopTraffic,
  triggerSysProxy
} from './utils/mihomo-ipc'
import { SEND, sendIpc } from './utils/ipc-channels'
import { calcTraffic } from './utils/calc'
import {
  closeFloatingWindow,
  showFloatingWindow,
  triggerMainWindow
} from './utils/window-ipc'
import { checkElevateTask } from './utils/service-ipc'

interface TrafficData {
  up: number
  down: number
}

const MODE_OPTIONS = [
  { key: 'rule', label: '规则' },
  { key: 'global', label: '全局' },
  { key: 'direct', label: '直连' }
] as const

const TrayMenuApp: React.FC = () => {
  const { groups, mutate } = useGroups()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const {
    autoCloseConnection = true,
    onlyActiveDevice = false,
    showFloatingWindow: showFloating = false,
    sysProxy
  } = appConfig || {}
  const { tun, mode } = controledMihomoConfig || {}

  const [traffic, setTraffic] = useState<TrafficData>({ up: 0, down: 0 })
  const [testingGroup, setTestingGroup] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const sysProxyEnabled = sysProxy?.enable ?? false
  const tunEnabled = tun?.enable ?? false

  useEffect(() => {
    return subscribeDesktopTraffic((info) => {
      setTraffic(info)
    }, true)
  }, [])

  const withBusyAction = async (action: string, job: () => Promise<void>): Promise<void> => {
    if (busyAction) {
      return
    }

    setBusyAction(action)
    try {
      await job()
    } catch (error) {
      alert(error)
    } finally {
      setBusyAction(null)
    }
  }

  const handleClose = (): void => {
    sendIpc(SEND.customTrayClose)
  }

  const handleRefresh = (): void => {
    mutate()
  }

  const handleShowMainWindow = async (): Promise<void> => {
    await withBusyAction('main-window', async () => {
      await triggerMainWindow()
      handleClose()
    })
  }

  const handleToggleFloating = async (): Promise<void> => {
    const nextVisible = !showFloating

    await withBusyAction('floating-window', async () => {
      if (nextVisible) {
        await showFloatingWindow()
      } else {
        await closeFloatingWindow()
      }
      await patchAppConfig({ showFloatingWindow: nextVisible })
    })
  }

  const handleToggleSysProxy = async (enable: boolean): Promise<void> => {
    await withBusyAction('sysproxy', async () => {
      await triggerSysProxy(enable, onlyActiveDevice)
      await patchAppConfig({ sysProxy: { enable } })
    })
  }

  const handleToggleTun = async (enable: boolean): Promise<void> => {
    await withBusyAction('tun', async () => {
      if (enable && platform === 'win32' && __ROUTEX_HOST__ === 'tauri') {
        const hasElevateTask = await checkElevateTask()
        if (!hasElevateTask) {
          throw new Error('请先到内核设置里注册提权任务，再启用虚拟网卡')
        }
      }

      const previousTun = tun ? { ...tun } : undefined
      const previousDns = controledMihomoConfig?.dns ? { ...controledMihomoConfig.dns } : undefined

      if (enable) {
        await patchControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
      } else {
        await patchControledMihomoConfig({ tun: { enable } })
      }
      try {
        await restartCore()
      } catch (error) {
        await patchControledMihomoConfig({
          tun: previousTun,
          ...(enable ? { dns: previousDns } : {})
        })
        throw error
      }
    })
  }

  const handleChangeMode = async (nextMode: OutboundMode): Promise<void> => {
    if (!mode || mode === nextMode) {
      return
    }

    await withBusyAction(`mode-${nextMode}`, async () => {
      await patchControledMihomoConfig({ mode: nextMode })
      await patchMihomoConfig({ mode: nextMode })
      if (autoCloseConnection) {
        await mihomoCloseAllConnections()
      }
      mutate()
    })
  }

  const handleQuitApp = async (): Promise<void> => {
    await withBusyAction('quit-app', async () => {
      handleClose()
      await quitApp()
    })
  }

  const handleTestDelay = async (groupName: string, testUrl?: string): Promise<void> => {
    setTestingGroup(groupName)
    try {
      await mihomoGroupDelay(groupName, testUrl)
      mutate()
    } catch {
      // ignore
    } finally {
      setTestingGroup(null)
    }
  }

  const handleSelectProxy = async (groupName: string, proxyName: string): Promise<void> => {
    try {
      await mihomoChangeProxy(groupName, proxyName)
      if (autoCloseConnection) {
        await mihomoCloseAllConnections()
      }
      mutate()
    } catch {
      // ignore
    }
  }

  const getDelayColor = (
    delay: number | undefined
  ): 'success' | 'warning' | 'danger' | 'default' => {
    if (delay === undefined || delay < 0) return 'default'
    if (delay === 0) return 'danger'
    if (delay <= 150) return 'success'
    if (delay <= 300) return 'warning'
    return 'danger'
  }

  const formatDelay = (delay: number | undefined): string => {
    if (delay === undefined || delay < 0) return '--'
    if (delay === 0) return 'Timeout'
    return `${delay} ms`
  }

  const getCurrentDelay = (group: ControllerMixedGroup): number | undefined => {
    const current = group.all?.find((p) => p.name === group.now)
    if (!current?.history?.length) return undefined
    return current.history[current.history.length - 1].delay
  }

  const getProxyDelay = (
    proxy: ControllerProxiesDetail | ControllerGroupDetail
  ): number | undefined => {
    if (!proxy.history?.length) return undefined
    return proxy.history[proxy.history.length - 1].delay
  }

  const defaultExpandedKeys = useMemo(() => {
    if (!groups) return []
    return groups.slice(0, 3).map((g) => g.name)
  }, [groups])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-divider bg-content1">
      <div className="flex items-center justify-between border-b border-divider bg-content2/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-lg shadow-primary/50" />
          <span className="text-sm font-semibold">RouteX</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={handleRefresh}
            className="h-6 min-w-6 w-6"
          >
            <IoRefresh className="text-base" />
          </Button>
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={handleClose}
            className="h-6 min-w-6 w-6"
          >
            <IoClose className="text-base" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-divider bg-content2/30 px-3 py-2">
        <Button
          size="sm"
          variant="flat"
          onPress={handleShowMainWindow}
          isLoading={busyAction === 'main-window'}
        >
          切换主窗口
        </Button>
        <Button
          size="sm"
          variant={showFloating ? 'solid' : 'flat'}
          onPress={handleToggleFloating}
          isLoading={busyAction === 'floating-window'}
        >
          {showFloating ? '关闭悬浮窗' : '显示悬浮窗'}
        </Button>
        <div className="flex items-center justify-between rounded-lg border border-divider bg-content1/80 px-2 py-1.5">
          <span className="text-xs font-medium">系统代理</span>
          <Switch
            size="sm"
            isSelected={sysProxyEnabled}
            isDisabled={busyAction !== null}
            onValueChange={handleToggleSysProxy}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-divider bg-content1/80 px-2 py-1.5">
          <span className="text-xs font-medium">虚拟网卡</span>
          <Switch
            size="sm"
            isSelected={tunEnabled}
            isDisabled={busyAction !== null}
            onValueChange={handleToggleTun}
          />
        </div>
      </div>

      <div className="border-b border-divider bg-content2/20 px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-default-500">出站模式</span>
          <Button
            size="sm"
            variant="light"
            className="h-6 min-w-0 px-2 text-xs"
            onPress={handleQuitApp}
            isLoading={busyAction === 'quit-app'}
          >
            退出
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((option) => {
            const isActive = mode === option.key
            return (
              <Button
                key={option.key}
                size="sm"
                variant={isActive ? 'solid' : 'flat'}
                color={isActive ? 'primary' : 'default'}
                className="min-w-0"
                isDisabled={busyAction !== null || !mode}
                isLoading={busyAction === `mode-${option.key}`}
                onPress={() => handleChangeMode(option.key)}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-b border-divider bg-content2/30 px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-default-500">↑</span>
          <span className="font-mono text-xs font-medium">{calcTraffic(traffic.up)}/s</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-default-500">↓</span>
          <span className="font-mono text-xs font-medium">{calcTraffic(traffic.down)}/s</span>
        </div>
      </div>

      <ScrollShadow className="flex-1 overflow-y-auto">
        {!groups || groups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-default-400">
            暂无数据
          </div>
        ) : (
          <Accordion
            selectionMode="multiple"
            defaultExpandedKeys={defaultExpandedKeys}
            className="px-1"
            itemClasses={{
              base: 'py-0',
              title: 'text-sm font-medium',
              trigger: 'rounded-lg px-2 py-2 data-[hover=true]:bg-default-100',
              content: 'pt-0 pb-2'
            }}
          >
            {groups.map((group) => (
              <AccordionItem
                key={group.name}
                aria-label={group.name}
                title={
                  <div className="flex w-full items-center justify-between pr-2">
                    <div className="flex items-center gap-2">
                      <span>{group.name}</span>
                      <Chip size="sm" variant="flat" className="h-4 text-[10px]">
                        {group.type}
                      </Chip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        isLoading={testingGroup === group.name}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTestDelay(group.name, group.testUrl)
                        }}
                        className="h-5 min-w-5 w-5"
                      >
                        <IoRefresh className="text-xs" />
                      </Button>
                      <Chip
                        size="sm"
                        color={getDelayColor(getCurrentDelay(group))}
                        variant="flat"
                        className="h-5 min-w-[52px] text-[10px]"
                      >
                        {formatDelay(getCurrentDelay(group))}
                      </Chip>
                    </div>
                  </div>
                }
              >
                <div className="flex flex-col gap-1 pl-2">
                  {group.all?.map((proxy) => {
                    const isActive = proxy.name === group.now
                    const delay = getProxyDelay(proxy)
                    return (
                      <div
                        key={proxy.name}
                        onClick={() => handleSelectProxy(group.name, proxy.name)}
                        className={`
                          flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5
                          transition-colors duration-150
                          ${isActive ? 'border border-primary/30 bg-primary/15' : 'hover:bg-default-100'}
                        `}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {isActive && (
                            <IoCheckmarkCircle className="shrink-0 text-sm text-primary" />
                          )}
                          <span
                            className={`truncate text-xs ${isActive ? 'font-medium text-primary' : ''}`}
                          >
                            {proxy.name}
                          </span>
                        </div>
                        <Chip
                          size="sm"
                          color={getDelayColor(delay)}
                          variant="flat"
                          className="h-4 min-w-[48px] shrink-0 text-[10px]"
                        >
                          {formatDelay(delay)}
                        </Chip>
                      </div>
                    )
                  })}
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollShadow>
    </div>
  )
}

export default TrayMenuApp
