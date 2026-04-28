import { app, BrowserWindow, powerMonitor } from 'electron'

interface ShutdownControllerOptions {
  getMainWindow: () => BrowserWindow | null
  getAppConfig: typeof import('../config').getAppConfig
  quitWithoutCore: typeof import('../core/manager').quitWithoutCore
  closeTrayIcon: typeof import('../resolve/tray').closeTrayIcon
  stopMapUpdateTimer: typeof import('../resolve/providerStats').stopMapUpdateTimer
  saveTrafficStats: typeof import('../resolve/trafficStats').saveTrafficStats
  saveProviderStats: typeof import('../resolve/providerStats').saveProviderStats
  triggerSysProxy: typeof import('../sys/sysproxy').triggerSysProxy
  stopCore: typeof import('../core/manager').stopCore
  showQuitConfirmDialog: () => Promise<boolean>
}

export function createShutdownController(options: ShutdownControllerOptions) {
  const {
    getMainWindow,
    getAppConfig,
    quitWithoutCore,
    closeTrayIcon,
    stopMapUpdateTimer,
    saveTrafficStats,
    saveProviderStats,
    triggerSysProxy,
    stopCore,
    showQuitConfirmDialog
  } = options

  let quitTimeout: NodeJS.Timeout | null = null
  let shutdownPromise: Promise<void> | null = null
  let isQuitting = false
  let notQuitDialog = false
  let lastQuitAttempt = 0
  let signalShutdownStarted = false

  function clearQuitTimeout(): void {
    if (quitTimeout) {
      clearTimeout(quitTimeout)
      quitTimeout = null
    }
  }

  async function scheduleLightweightMode(): Promise<void> {
    const {
      autoLightweight = false,
      autoLightweightDelay = 60,
      autoLightweightMode = 'core'
    } = await getAppConfig()

    if (!autoLightweight) return

    clearQuitTimeout()

    quitTimeout = setTimeout(async () => {
      if (autoLightweightMode === 'core') {
        await quitWithoutCore()
        return
      }

      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.destroy()
        if (process.platform === 'darwin' && app.dock) {
          app.dock.hide()
        }
      }
    }, autoLightweightDelay * 1000)
  }

  function setNotQuitDialog(): void {
    notQuitDialog = true
  }

  async function closeUiSurfaces(): Promise<void> {
    await Promise.resolve(closeTrayIcon()).catch(() => undefined)

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    }
  }

  async function performAppShutdown(): Promise<void> {
    if (shutdownPromise) {
      await shutdownPromise
      return
    }

    shutdownPromise = (async () => {
      stopMapUpdateTimer()
      await Promise.allSettled([
        saveTrafficStats(),
        saveProviderStats(),
        triggerSysProxy(false, false)
      ])
      await stopCore()
    })()

    await shutdownPromise
  }

  async function exitAppAfterShutdown(): Promise<void> {
    clearQuitTimeout()
    await performAppShutdown()
    await closeUiSurfaces()
    app.exit(0)
  }

  function handleProcessSignal(signal: NodeJS.Signals | 'graceful-exit'): void {
    if (signalShutdownStarted) {
      return
    }

    signalShutdownStarted = true
    console.log(`[shutdown] received ${signal}, exiting gracefully`)
    void exitAppAfterShutdown().catch((error) => {
      console.error(`[shutdown] graceful exit failed after ${signal}:`, error)
      app.exit(1)
    })
  }

  function registerHooks(): void {
    app.on('before-quit', async (event) => {
      if (!isQuitting && !notQuitDialog) {
        event.preventDefault()

        const now = Date.now()
        if (now - lastQuitAttempt < 500) {
          isQuitting = true
          await exitAppAfterShutdown()
          return
        }
        lastQuitAttempt = now

        const confirmed = await showQuitConfirmDialog()
        if (confirmed) {
          isQuitting = true
          await exitAppAfterShutdown()
        }
      } else if (notQuitDialog) {
        isQuitting = true
        await exitAppAfterShutdown()
      }
    })

    powerMonitor.on('shutdown', async () => {
      await exitAppAfterShutdown()
    })

    process.once('SIGINT', () => {
      handleProcessSignal('SIGINT')
    })

    process.once('SIGTERM', () => {
      handleProcessSignal('SIGTERM')
    })

    process.once('message', (message) => {
      if (message === 'graceful-exit') {
        handleProcessSignal('graceful-exit')
      }
    })
  }

  return {
    clearQuitTimeout,
    exitAppAfterShutdown,
    registerHooks,
    scheduleLightweightMode,
    setNotQuitDialog
  }
}
