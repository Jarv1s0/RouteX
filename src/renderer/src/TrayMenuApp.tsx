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
    <div className="traymenu-shell flex h-screen w-screen p-3">
      <div className="traymenu-panel flex h-full w-full flex-col overflow-hidden rounded-[26px] border border-white/55 bg-content1/92 shadow-[0_28px_90px_rgba(15,23,42,0.28)] backdrop-blur-[22px] dark:border-white/10 dark:bg-slate-950/88">
      <div className="flex items-center justify-between border-b border-default-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.72))] px-4 py-3 dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))]">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_16px_rgba(14,165,233,0.65)]" />
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-semibold tracking-[0.14em] text-default-500 uppercase">RouteX</span>
            <span className="mt-1 text-[15px] font-semibold text-foreground">快速控制台</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={handleRefresh}
            className="h-8 min-w-8 w-8 rounded-full bg-white/65 text-default-600 shadow-sm hover:bg-white dark:bg-white/6 dark:text-default-300 dark:hover:bg-white/12"
          >
            <IoRefresh className="text-base" />
          </Button>
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={handleClose}
            className="h-8 min-w-8 w-8 rounded-full bg-white/65 text-default-600 shadow-sm hover:bg-danger/10 hover:text-danger dark:bg-white/6 dark:text-default-300 dark:hover:bg-danger/12"
          >
            <IoClose className="text-base" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-b border-default-200/70 bg-default-50/55 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03]">
        <Button
          size="sm"
          variant="flat"
          onPress={handleShowMainWindow}
          isLoading={busyAction === 'main-window'}
          className="rounded-2xl bg-white/75 font-medium text-foreground shadow-sm hover:bg-white dark:bg-white/6 dark:hover:bg-white/10"
        >
          切换主窗口
        </Button>
        <Button
          size="sm"
          variant={showFloating ? 'solid' : 'flat'}
          onPress={handleToggleFloating}
          isLoading={busyAction === 'floating-window'}
          className={`rounded-2xl font-medium shadow-sm ${showFloating ? '' : 'bg-white/75 text-foreground hover:bg-white dark:bg-white/6 dark:hover:bg-white/10'}`}
        >
          {showFloating ? '关闭悬浮窗' : '显示悬浮窗'}
        </Button>
        <div className="flex items-center justify-between rounded-2xl border border-default-200/70 bg-white/78 px-3 py-2 shadow-sm dark:border-white/8 dark:bg-white/6">
          <span className="text-xs font-medium">系统代理</span>
          <Switch
            size="sm"
            isSelected={sysProxyEnabled}
            isDisabled={busyAction !== null}
            onValueChange={handleToggleSysProxy}
          />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-default-200/70 bg-white/78 px-3 py-2 shadow-sm dark:border-white/8 dark:bg-white/6">
          <span className="text-xs font-medium">虚拟网卡</span>
          <Switch
            size="sm"
            isSelected={tunEnabled}
            isDisabled={busyAction !== null}
            onValueChange={handleToggleTun}
          />
        </div>
      </div>

      <div className="border-b border-default-200/70 bg-default-50/45 px-4 py-3 dark:border-white/8 dark:bg-white/[0.025]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-default-500">出站模式</span>
          <Button
            size="sm"
            variant="light"
            className="h-7 min-w-0 rounded-full bg-white/65 px-3 text-xs font-medium text-default-600 hover:bg-danger/10 hover:text-danger dark:bg-white/6 dark:text-default-300 dark:hover:bg-danger/12"
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
                className={`min-w-0 rounded-2xl font-medium ${isActive ? '' : 'bg-white/78 text-foreground hover:bg-white dark:bg-white/6 dark:hover:bg-white/10'}`}
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

      <div className="flex items-center justify-center gap-3 border-b border-default-200/70 bg-[linear-gradient(90deg,rgba(14,165,233,0.08),rgba(56,189,248,0.03),rgba(59,130,246,0.08))] px-4 py-3 dark:border-white/8 dark:bg-[linear-gradient(90deg,rgba(14,165,233,0.12),rgba(15,23,42,0),rgba(59,130,246,0.12))]">
        <div className="flex items-center gap-1.5 rounded-full bg-white/72 px-3 py-1 shadow-sm dark:bg-white/6">
          <span className="text-xs text-cyan-500">↑</span>
          <span className="font-mono text-xs font-semibold">{calcTraffic(traffic.up)}/s</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/72 px-3 py-1 shadow-sm dark:bg-white/6">
          <span className="text-xs text-sky-600 dark:text-sky-400">↓</span>
          <span className="font-mono text-xs font-semibold">{calcTraffic(traffic.down)}/s</span>
        </div>
      </div>

      <ScrollShadow className="traymenu-scroll flex-1 overflow-y-auto px-2 pb-2 pt-1">
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
              trigger: 'rounded-2xl border border-transparent px-3 py-2.5 data-[hover=true]:border-default-200/80 data-[hover=true]:bg-white/80 dark:data-[hover=true]:border-white/10 dark:data-[hover=true]:bg-white/6',
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
                        className="h-6 min-w-6 w-6 rounded-full bg-white/70 shadow-sm hover:bg-white dark:bg-white/6 dark:hover:bg-white/12"
                      >
                        <IoRefresh className="text-xs" />
                      </Button>
                      <Chip
                        size="sm"
                        color={getDelayColor(getCurrentDelay(group))}
                        variant="flat"
                        className="h-5 min-w-[56px] rounded-full text-[10px]"
                      >
                        {formatDelay(getCurrentDelay(group))}
                      </Chip>
                    </div>
                  </div>
                }
              >
                <div className="flex flex-col gap-1.5 pl-2 pr-1 pt-1">
                  {group.all?.map((proxy) => {
                    const isActive = proxy.name === group.now
                    const delay = getProxyDelay(proxy)
                    return (
                      <div
                        key={proxy.name}
                        onClick={() => handleSelectProxy(group.name, proxy.name)}
                        className={`
                          flex cursor-pointer items-center justify-between rounded-2xl px-3 py-2
                          transition-colors duration-150
                          ${isActive ? 'border border-primary/25 bg-primary/12 shadow-[0_10px_24px_rgba(14,165,233,0.12)]' : 'border border-transparent bg-white/54 hover:border-default-200/80 hover:bg-white/82 dark:bg-white/[0.03] dark:hover:border-white/10 dark:hover:bg-white/[0.06]'}
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
                          className="h-5 min-w-[52px] shrink-0 rounded-full text-[10px]"
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
    </div>
  )
}

export default TrayMenuApp
