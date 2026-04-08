import { app, BrowserWindow } from 'electron'

type DialogType = 'info' | 'error' | 'warning' | 'success'

interface StartupOptions {
  isDev: boolean
  argv: string[]
  syncConfig: AppConfig
  initPromise: Promise<void>
  registerRendererCsp: () => void
  showDialog: (type: DialogType, title: string, content: string) => void
  ensureElevatedStartup: typeof import('./elevation').ensureElevatedStartup
  patchControledMihomoConfig: typeof import('../config').patchControledMihomoConfig
  loadTrafficStats: typeof import('../resolve/trafficStats').loadTrafficStats
  loadProviderStats: typeof import('../resolve/providerStats').loadProviderStats
  startMapUpdateTimer: typeof import('../resolve/providerStats').startMapUpdateTimer
  watchWindowShortcuts: (window: BrowserWindow) => void
  getAppConfig: typeof import('../config').getAppConfig
  registerIpcMainHandlers: typeof import('../utils/ipc').registerIpcMainHandlers
  registerTaskbarIconHandler: (getMainWindow: () => BrowserWindow | null) => void
  getMainWindow: () => BrowserWindow | null
  createWindow: (appConfig?: AppConfig) => Promise<void>
  startCore: typeof import('../core/manager').startCore
  initProfileUpdater: typeof import('../core/profileUpdater').initProfileUpdater
  startMonitor: typeof import('../resolve/trafficMonitor').startMonitor
  initShortcut: typeof import('../resolve/shortcut').initShortcut
  showFloatingWindow: typeof import('../resolve/floatingWindow').showFloatingWindow
  createTray: typeof import('../resolve/tray').createTray
  onCoreStarted: typeof import('../resolve/providerStats').onCoreStarted
  showMainWindow: () => Promise<void>
}

export async function runAppStartup(options: StartupOptions): Promise<void> {
  const {
    isDev,
    argv,
    syncConfig,
    initPromise,
    registerRendererCsp,
    showDialog,
    ensureElevatedStartup,
    patchControledMihomoConfig,
    loadTrafficStats,
    loadProviderStats,
    startMapUpdateTimer,
    watchWindowShortcuts,
    getAppConfig,
    registerIpcMainHandlers,
    registerTaskbarIconHandler,
    getMainWindow,
    createWindow,
    startCore,
    initProfileUpdater,
    startMonitor,
    initShortcut,
    showFloatingWindow,
    createTray,
    onCoreStarted,
    showMainWindow
  } = options

  registerRendererCsp()

  const canContinueStartup = await ensureElevatedStartup({
    isDev,
    argv,
    corePermissionMode: syncConfig.corePermissionMode
  })

  if (!canContinueStartup) {
    return
  }

  if (process.platform === 'win32' && isDev) {
    await patchControledMihomoConfig({ tun: { enable: false } })
  }

  try {
    await initPromise
  } catch (error) {
    showDialog('error', '应用初始化失败', `${error}`)
    app.quit()
    return
  }

  loadTrafficStats()

  app.on('browser-window-created', (_, window) => {
    watchWindowShortcuts(window)
  })

  const appConfig = await getAppConfig()
  const { showFloatingWindow: showFloating = false, disableTray = false } = appConfig

  registerIpcMainHandlers()
  registerTaskbarIconHandler(getMainWindow)

  const createWindowPromise = createWindow(appConfig)

  let coreStarted = false

  const coreStartPromise = (async (): Promise<void> => {
    try {
      const [startPromise] = await startCore()
      startPromise.then(async () => {
        await initProfileUpdater()
      })
      coreStarted = true
    } catch (error) {
      showDialog('error', '内核启动出错', `${error}`)
    }
  })()

  const monitorPromise = (async (): Promise<void> => {
    try {
      await startMonitor()
    } catch {
      // ignore
    }
  })()

  await createWindowPromise

  const providerStatsPromise = (async (): Promise<void> => {
    try {
      await loadProviderStats()
      startMapUpdateTimer()
    } catch {
      // ignore
    }
  })()

  const uiTasks: Promise<void>[] = [initShortcut()]
  if (showFloating) {
    uiTasks.push(Promise.resolve(showFloatingWindow()))
  }
  if (!disableTray) {
    uiTasks.push(createTray())
  }

  await Promise.all(uiTasks)
  await Promise.all([coreStartPromise, monitorPromise, providerStatsPromise])

  if (coreStarted) {
    getMainWindow()?.webContents.send('core-started')
    onCoreStarted()
  }

  app.on('activate', () => {
    void showMainWindow()
  })
}
