import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import windowStateKeeper from 'electron-window-state'
import {
  app,
  BrowserWindow,
  Menu
} from 'electron'
import { getAppConfig, patchControledMihomoConfig } from './config'
import { quitWithoutCore, startCore, stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import { createTray } from './resolve/tray'
import { createApplicationMenu } from './resolve/menu'
import { init } from './utils/init'
import { join } from 'path'
import { initShortcut } from './resolve/shortcut'
import { initProfileUpdater } from './core/profileUpdater'
import { exePath, getIconPath } from './utils/dirs'
import { startMonitor } from './resolve/trafficMonitor'
import { showFloatingWindow } from './resolve/floatingWindow'
import { getAppConfigSync } from './config/app'
import { registerRendererCsp } from './utils/csp'
import { loadTrafficStats, saveTrafficStats } from './resolve/trafficStats'
import {
  loadProviderStats,
  startMapUpdateTimer,
  onCoreStarted,
  saveProviderStats,
  stopMapUpdateTimer
} from './resolve/providerStats'
import { customRelaunch as relaunchProcess } from './utils/relaunch'
import { ensureElevatedStartup } from './bootstrap/elevation'
import { runAppStartup } from './bootstrap/startup'
import { registerTaskbarIconHandler } from './resolve/taskbarIcon'
import { createShutdownController } from './bootstrap/shutdown'
import { createDeepLinkHandler } from './resolve/deepLink'
import { createMainWindowController, registerMainWindowLifecycleHandlers } from './resolve/mainWindow'
import { syncLatestConnectionsSnapshotToWindow } from './core/mihomoApi'
export let mainWindow: BrowserWindow | null = null
let isCreatingWindow = false
let windowShown = false
let createWindowPromiseResolve: (() => void) | null = null
let createWindowPromise: Promise<void> | null = null
let mainWindowDidFinishLoad = false

const syncConfig = getAppConfigSync()

// Elevation logic moved to app.whenReady()

// Dev TUN control moved to whenReady to ensure proper initialization sequence

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

export function customRelaunch(): void {
  customRelaunchImpl()
}

function customRelaunchImpl(): void {
  relaunchProcess(process.pid, process.argv)
}

if (process.platform === 'linux') {
  app.relaunch = customRelaunch
}

if (process.platform === 'win32' && !exePath().startsWith('C')) {
  // https://github.com/electron/electron/issues/36698
  app.commandLine.appendSwitch('in-process-gpu')
}

// 内存优化：限制 V8 堆内存大小，减少主进程内存占用 (默认通常过大)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256')

const initPromise = init()

if (syncConfig.disableGPU) {
  app.disableHardwareAcceleration()
}

app.on('second-instance', async (_event, commandline) => {
  showMainWindow()
  const url = commandline.pop()
  if (url) {
    await handleDeepLink(url)
  }
})

app.on('open-url', async (_event, url) => {
  showMainWindow()
  await handleDeepLink(url)
})

const {
  reloadMainWindowRenderer,
  showPendingWindowIfNeeded,
  showDialog,
  showQuitConfirmDialog,
  showWindow
} = createMainWindowController({
  getMainWindow: () => mainWindow,
  getMainWindowDidFinishLoad: () => mainWindowDidFinishLoad,
  setMainWindowDidFinishLoad: (value) => {
    mainWindowDidFinishLoad = value
  },
  syncLatestConnectionsSnapshot: syncLatestConnectionsSnapshotToWindow
})

const handleDeepLink = createDeepLinkHandler({
  createWindow: () => createWindow(),
  getMainWindow: () => mainWindow,
  showWindow
})

const shutdownController = createShutdownController({
  getMainWindow: () => mainWindow,
  getAppConfig,
  quitWithoutCore,
  stopMapUpdateTimer,
  saveTrafficStats,
  saveProviderStats,
  triggerSysProxy,
  stopCore,
  showQuitConfirmDialog
})

const {
  clearQuitTimeout,
  registerHooks: registerShutdownHooks,
  scheduleLightweightMode,
  setNotQuitDialog
} = shutdownController

export { setNotQuitDialog }

app.on('window-all-closed', () => {
  // Don't quit app when all windows are closed
})

registerShutdownHooks()

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('routex.app')

  await runAppStartup({
    isDev: is.dev,
    argv: process.argv,
    syncConfig,
    initPromise,
    registerRendererCsp,
    showDialog,
    ensureElevatedStartup,
    patchControledMihomoConfig,
    loadTrafficStats,
    loadProviderStats,
    startMapUpdateTimer,
    watchWindowShortcuts: optimizer.watchWindowShortcuts,
    getAppConfig,
    registerIpcMainHandlers,
    registerTaskbarIconHandler,
    getMainWindow: () => mainWindow,
    createWindow,
    startCore,
    initProfileUpdater,
    startMonitor,
    initShortcut,
    showFloatingWindow,
    createTray,
    onCoreStarted,
    showMainWindow
  })
})

export async function createWindow(appConfig?: AppConfig): Promise<void> {
  if (isCreatingWindow) {
    if (createWindowPromise) {
      await createWindowPromise
    }
    return
  }
  isCreatingWindow = true
  createWindowPromise = new Promise<void>((resolve) => {
    createWindowPromiseResolve = resolve
  })
  try {
    const config = appConfig ?? (await getAppConfig())
    const { useWindowFrame = false } = config

    const [mainWindowState] = await Promise.all([
      Promise.resolve(
        windowStateKeeper({
          defaultWidth: 800,
          defaultHeight: 700,
          file: 'window-state.json'
        })
      ),
      process.platform === 'darwin'
        ? createApplicationMenu()
        : Promise.resolve(Menu.setApplicationMenu(null))
    ])
    mainWindow = new BrowserWindow({
      minWidth: 800,
      minHeight: 600,
      width: mainWindowState.width,
      height: mainWindowState.height,
      x: mainWindowState.x,
      y: mainWindowState.y,
      show: false,
      frame: useWindowFrame,
      fullscreenable: false,
      titleBarStyle: useWindowFrame ? 'default' : 'hidden',
      // 保留自定义窗口按钮时，禁用系统标题栏覆盖区，避免点击区域冲突
      titleBarOverlay: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon: getIconPath('icon.png') } : 
         process.platform === 'win32' ? { icon: getIconPath('icon.ico') } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        spellcheck: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webviewTag: false
      }
    })
    mainWindowState.manage(mainWindow)
    registerMainWindowLifecycleHandlers({
      mainWindow,
      mainWindowState,
      getAppConfig,
      clearQuitTimeout,
      scheduleLightweightMode,
      getWindowShown: () => windowShown,
      markWindowShown: () => {
        windowShown = true
      },
      resetMainWindow: () => {
        mainWindowDidFinishLoad = false
        mainWindow = null
      },
      reloadMainWindowRenderer,
      setMainWindowDidFinishLoad: (value) => {
        mainWindowDidFinishLoad = value
      },
      showPendingWindowIfNeeded,
      syncLatestConnectionsSnapshot: syncLatestConnectionsSnapshotToWindow,
      triggerSysProxy,
      stopCore
    })
  } finally {
    isCreatingWindow = false
    if (createWindowPromiseResolve) {
      createWindowPromiseResolve()
      createWindowPromiseResolve = null
    }
    createWindowPromise = null
  }
}

export async function triggerMainWindow(): Promise<void> {
  if (mainWindow && mainWindow.isVisible()) {
    closeMainWindow()
  } else {
    await showMainWindow()
  }
}

export async function showMainWindow(): Promise<void> {
  clearQuitTimeout()
  if (process.platform === 'darwin' && app.dock) {
    const { useDockIcon = true } = await getAppConfig()
    if (!useDockIcon) {
      app.dock.hide()
    }
  }
  if (mainWindow) {
    windowShown = true
    showWindow()
  } else {
    await createWindow()
    if (mainWindow !== null) {
      windowShown = true
      showWindow()
    }
  }
}

export function closeMainWindow(): void {
  if (mainWindow) {
    mainWindow.close()
  }
}
