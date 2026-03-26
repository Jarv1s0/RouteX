import { is } from '@electron-toolkit/utils'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { shouldReportRendererConsoleMessage } from '../utils/rendererConsole'

type WindowDialogType = 'info' | 'error' | 'warning' | 'success'

interface MainWindowControllerOptions {
  getMainWindow: () => BrowserWindow | null
  getMainWindowDidFinishLoad: () => boolean
  setMainWindowDidFinishLoad: (value: boolean) => void
}

interface RegisterMainWindowLifecycleHandlersOptions {
  mainWindow: BrowserWindow
  mainWindowState: {
    saveState: (window: BrowserWindow) => void
  }
  getAppConfig: typeof import('../config').getAppConfig
  clearQuitTimeout: () => void
  scheduleLightweightMode: () => Promise<void>
  getWindowShown: () => boolean
  markWindowShown: () => void
  resetMainWindow: () => void
  reloadMainWindowRenderer: () => void
  setMainWindowDidFinishLoad: (value: boolean) => void
  triggerSysProxy: typeof import('../sys/sysproxy').triggerSysProxy
  stopCore: typeof import('../core/manager').stopCore
}

function getActiveMainWindow(getMainWindow: () => BrowserWindow | null): BrowserWindow | null {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null
  }
  return mainWindow
}

function logRendererConsoleMessage(args: unknown[]): void {
  const details =
    args.length === 1 && args[0] && typeof args[0] === 'object'
      ? (args[0] as Record<string, unknown>)
      : {
          level: args[0],
          message: args[1],
          lineNumber: args[2],
          sourceId: args[3]
        }

  const level = typeof details.level === 'number' ? details.level : 0
  const message = typeof details.message === 'string' ? details.message : String(details.message ?? '')
  const lineNumber = typeof details.lineNumber === 'number' ? details.lineNumber : 0
  const sourceId = typeof details.sourceId === 'string' ? details.sourceId : 'unknown'
  const prefix = `[renderer:${level}] ${sourceId}:${lineNumber}`

  if (!shouldReportRendererConsoleMessage(level, message)) {
    return
  }

  console.error(prefix, message)
}

export function createMainWindowController(options: MainWindowControllerOptions) {
  function reloadMainWindowRenderer(): void {
    const mainWindow = getActiveMainWindow(options.getMainWindow)
    if (!mainWindow) return

    options.setMainWindowDidFinishLoad(false)
    mainWindow.webContents.reload()
  }

  function ensureMainWindowRendererReady(): void {
    const mainWindow = getActiveMainWindow(options.getMainWindow)
    if (!mainWindow) return

    if (mainWindow.webContents.isCrashed()) {
      reloadMainWindowRenderer()
      return
    }

    if (!options.getMainWindowDidFinishLoad() && !mainWindow.webContents.isLoadingMainFrame()) {
      reloadMainWindowRenderer()
    }
  }

  function focusMainWindow(): void {
    const mainWindow = getActiveMainWindow(options.getMainWindow)
    if (!mainWindow) return

    mainWindow.focusOnWebView()
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu')
    mainWindow.focus()
    mainWindow.setAlwaysOnTop(false)
  }

  function showWindow(): number {
    const mainWindow = getActiveMainWindow(options.getMainWindow)
    if (!mainWindow) {
      return 500
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    } else if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    focusMainWindow()
    ensureMainWindowRendererReady()

    return mainWindow.isMinimized() ? 500 : 100
  }

  function showDialog(type: WindowDialogType, title: string, content: string): void {
    const mainWindow = getActiveMainWindow(options.getMainWindow)
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.webContents.send('show-dialog-modal', type, title, content)
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      return
    }

    if (type === 'error') {
      dialog.showErrorBox(title, content)
      return
    }

    const dialogType: 'info' | 'warning' = type === 'success' ? 'info' : type
    void dialog.showMessageBox({ type: dialogType, title, message: title, detail: content })
  }

  async function showQuitConfirmDialog(): Promise<boolean> {
    const currentWindow = getActiveMainWindow(options.getMainWindow)
    if (!currentWindow) {
      return true
    }

    const delay = showWindow()
    return new Promise((resolve) => {
      setTimeout(() => {
        getActiveMainWindow(options.getMainWindow)?.webContents.send('show-quit-confirm')
        ipcMain.once('quit-confirm-result', (_event: Electron.IpcMainEvent, confirmed: boolean) => {
          resolve(confirmed)
        })
      }, delay)
    })
  }

  return {
    ensureMainWindowRendererReady,
    focusMainWindow,
    reloadMainWindowRenderer,
    showDialog,
    showQuitConfirmDialog,
    showWindow
  }
}

export function registerMainWindowLifecycleHandlers(
  options: RegisterMainWindowLifecycleHandlersOptions
): void {
  const {
    mainWindow,
    mainWindowState,
    getAppConfig,
    clearQuitTimeout,
    scheduleLightweightMode,
    getWindowShown,
    markWindowShown,
    resetMainWindow,
    reloadMainWindowRenderer,
    setMainWindowDidFinishLoad,
    triggerSysProxy,
    stopCore
  } = options

  mainWindow.on('ready-to-show', async () => {
    const { silentStart = false } = await getAppConfig()
    if (!silentStart) {
      clearQuitTimeout()
      markWindowShown()
      mainWindow.show()
      mainWindow.focusOnWebView()
    } else {
      await scheduleLightweightMode()
    }
  })

  mainWindow.webContents.on('did-start-loading', () => {
    setMainWindowDidFinishLoad(false)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    setMainWindowDidFinishLoad(true)
  })

  mainWindow.webContents.on('did-fail-load', () => {
    reloadMainWindowRenderer()
  })

  mainWindow.webContents.on('console-message', (_event, ...args: unknown[]) => {
    logRendererConsoleMessage(args)
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('[renderer] did-fail-load', {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame
      })
    }
  )

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process crashed:', details)
    reloadMainWindowRenderer()
  })

  mainWindow.on('unresponsive', () => {
    console.warn('Main window became unresponsive')
    reloadMainWindowRenderer()
  })

  mainWindow.on('responsive', () => {
    console.log('Main window became responsive again')
  })

  mainWindow.on('close', async (event) => {
    event.preventDefault()
    mainWindow.hide()
    if (getWindowShown()) {
      await scheduleLightweightMode()
    }
  })

  mainWindow.on('closed', () => {
    resetMainWindow()
  })

  mainWindow.on('resized', () => {
    mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('unmaximize', () => {
    mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('move', () => {
    mainWindowState.saveState(mainWindow)
  })

  mainWindow.on('session-end', async () => {
    triggerSysProxy(false, false)
    await stopCore()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  setMainWindowDidFinishLoad(false)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
