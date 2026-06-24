import { useState } from 'react'
import { useAppConfig } from './use-app-config'
import { useControledMihomoConfig } from './use-controled-mihomo-config'
import { useGroups } from './use-groups'
import { platform } from '@renderer/utils/init'
import { quitApp } from '@renderer/utils/app-ipc'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  patchControledMihomoConfig,
  restartCore,
  triggerSysProxy
} from '@renderer/utils/mihomo-ipc'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import {
  closeFloatingWindow,
  showFloatingWindow,
  triggerMainWindow
} from '@renderer/utils/window-ipc'
import { checkElevateTask } from '@renderer/utils/service-ipc'
import { useI18n } from '@renderer/i18n'
import { applyOutboundModeChange } from '@renderer/utils/outbound-mode'

export function useTrayActions() {
  const { t } = useI18n()
  const { mutate } = useGroups()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()

  const {
    autoCloseConnection = true,
    onlyActiveDevice = false,
    showFloatingWindow: showFloating = false
  } = appConfig || {}
  const { tun, mode } = controledMihomoConfig || {}

  const [testingGroup, setTestingGroup] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

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
          throw new Error(t('tray.enableTunFirst'))
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
      await applyOutboundModeChange({
        currentMode: mode,
        nextMode,
        autoCloseConnection,
        persistMode: async (mode) => {
          await patchControledMihomoConfig({ mode })
          return true
        }
      })
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

  return {
    busyAction,
    testingGroup,
    showFloating,
    handleClose,
    handleRefresh,
    handleShowMainWindow,
    handleToggleFloating,
    handleToggleSysProxy,
    handleToggleTun,
    handleChangeMode,
    handleQuitApp,
    handleTestDelay,
    handleSelectProxy
  }
}
