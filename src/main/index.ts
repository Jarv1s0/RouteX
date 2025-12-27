import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcMainHandlers } from './utils/ipc'
import windowStateKeeper from 'electron-window-state'
import {
  app,
  shell,
  BrowserWindow,
  Menu,
  dialog,
  Notification,
  powerMonitor,
  ipcMain
} from 'electron'
import { addOverrideItem, addProfileItem, getAppConfig, patchControledMihomoConfig } from './config'
import { quitWithoutCore, startCore, stopCore } from './core/manager'
import { triggerSysProxy } from './sys/sysproxy'
import icon from '../../resources/icon.png?asset'
import { createTray } from './resolve/tray'
import { createApplicationMenu } from './resolve/menu'
import { init } from './utils/init'
import { join } from 'path'
import { initShortcut } from './resolve/shortcut'
import { execSync, spawn } from 'child_process'
import { createElevateTaskSync } from './sys/misc'
import { initProfileUpdater } from './core/profileUpdater'
import { copyFileSync, existsSync, writeFileSync } from 'fs'
import { exePath, resourcesFilesDir, taskDir } from './utils/dirs'
import path from 'path'
import { startMonitor } from './resolve/trafficMonitor'
import { showFloatingWindow } from './resolve/floatingWindow'
import iconv from 'iconv-lite'
import { getAppConfigSync } from './config/app'
import { getUserAgent } from './utils/userAgent'
import { loadTrafficStats, saveTrafficStats } from './resolve/trafficStats'
import { loadProviderStats, startMapUpdateTimer, onCoreStarted } from './resolve/providerStats'
import { startNetworkHealthMonitor } from './resolve/networkHealth'

let quitTimeout: NodeJS.Timeout | null = null
export let mainWindow: BrowserWindow | null = null
let isCreatingWindow = false
let windowShown = false
let createWindowPromiseResolve: (() => void) | null = null
let createWindowPromise: Promise<void> | null = null

async function scheduleLightweightMode(): Promise<void> {
  const {
    autoLightweight = false,
    autoLightweightDelay = 60,
    autoLightweightMode = 'core'
  } = await getAppConfig()

  if (!autoLightweight) return

  if (quitTimeout) {
    clearTimeout(quitTimeout)
  }

  const enterLightweightMode = async (): Promise<void> => {
    if (autoLightweightMode === 'core') {
      await quitWithoutCore()
    } else if (autoLightweightMode === 'tray') {
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.destroy()
        if (process.platform === 'darwin' && app.dock) {
          app.dock.hide()
        }
      }
    }
  }

  quitTimeout = setTimeout(enterLightweightMode, autoLightweightDelay * 1000)
}

const syncConfig = getAppConfigSync()

if (
  process.platform === 'win32' &&
  !is.dev &&
  !process.argv.includes('noadmin') &&
  syncConfig.corePermissionMode !== 'service'
) {
  try {
    createElevateTaskSync()
  } catch (createError) {
    // 检查计划任务是否已存在
    let taskExists = false
    try {
      execSync('%SystemRoot%\\System32\\schtasks.exe /query /tn "sparkle-run"', { stdio: 'pipe' })
      taskExists = true
    } catch {
      // 计划任务不存在
    }

    if (taskExists) {
      // 计划任务已存在，尝试运行
      try {
        if (process.argv.slice(1).length > 0) {
          writeFileSync(path.join(taskDir(), 'param.txt'), process.argv.slice(1).join(' '))
        } else {
          writeFileSync(path.join(taskDir(), 'param.txt'), 'empty')
        }
        // 确保 sparkle-run.exe 存在
        const sparkleRunDest = path.join(taskDir(), 'sparkle-run.exe')
        if (!existsSync(sparkleRunDest)) {
          const sparkleRunSrc = path.join(resourcesFilesDir(), 'sparkle-run.exe')
          if (existsSync(sparkleRunSrc)) {
            copyFileSync(sparkleRunSrc, sparkleRunDest)
          }
        }
        execSync('%SystemRoot%\\System32\\schtasks.exe /run /tn "sparkle-run"')
        app.exit()
      } catch (e) {
        let createErrorStr = `${createError}`
        let eStr = `${e}`
        try {
          createErrorStr = iconv.decode((createError as { stderr: Buffer }).stderr, 'gbk')
          eStr = iconv.decode((e as { stderr: Buffer }).stderr, 'gbk')
        } catch {
          // ignore
        }
        dialog.showErrorBox(
          '启动失败',
          `无法启动应用\n${createErrorStr}\n${eStr}`
        )
        app.exit()
      }
    } else {
      // 首次启动，计划任务不存在，必须使用管理员权限
      let errorMsg = '首次启动需要管理员权限来创建系统任务。\n\n请右键点击应用图标，选择"以管理员身份运行"。'
      try {
        const stderr = (createError as { stderr: Buffer }).stderr
        if (stderr) {
          const decodedError = iconv.decode(stderr, 'gbk')
          errorMsg += `\n\n错误详情：\n${decodedError}`
        }
      } catch {
        errorMsg += `\n\n错误详情：\n${createError}`
      }
      dialog.showErrorBox('需要管理员权限', errorMsg)
      app.exit()
    }
  }
}

if (process.platform === 'win32' && is.dev) {
  patchControledMihomoConfig({ tun: { enable: false } })
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

export function customRelaunch(): void {
  const script = `while kill -0 ${process.pid} 2>/dev/null; do
  sleep 0.1
done
${process.argv.join(' ')} & disown
exit
`
  spawn('sh', ['-c', `"${script}"`], {
    shell: true,
    detached: true,
    stdio: 'ignore'
  })
}

if (process.platform === 'linux') {
  app.relaunch = customRelaunch
}

if (process.platform === 'win32' && !exePath().startsWith('C')) {
  // https://github.com/electron/electron/issues/43278
  // https://github.com/electron/electron/issues/36698
  app.commandLine.appendSwitch('in-process-gpu')
}

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

let isQuitting = false,
  notQuitDialog = false

let lastQuitAttempt = 0

export function setNotQuitDialog(): void {
  notQuitDialog = true
}

function showWindow(): number {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    } else if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focusOnWebView()
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu')
    mainWindow.focus()
    mainWindow.setAlwaysOnTop(false)
    
    // 检查渲染进程是否正常，如果崩溃则重新加载
    if (mainWindow.webContents.isCrashed()) {
      mainWindow.webContents.reload()
    } else {
      // 检查页面是否正常加载（防止白屏）
      mainWindow.webContents.executeJavaScript('document.body ? document.body.innerHTML.length : 0')
        .then((length) => {
          if (length === 0 && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload()
          }
        })
        .catch(() => {
          // 执行失败，可能渲染进程有问题，尝试重新加载
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload()
          }
        })
    }

    if (!mainWindow.isMinimized()) {
      return 100
    }
  }
  return 500
}

function showQuitConfirmDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mainWindow) {
      resolve(true)
      return
    }

    const delay = showWindow()
    setTimeout(() => {
      mainWindow?.webContents.send('show-quit-confirm')
      const handleQuitConfirm = (_event: Electron.IpcMainEvent, confirmed: boolean): void => {
        ipcMain.off('quit-confirm-result', handleQuitConfirm)
        resolve(confirmed)
      }
      ipcMain.once('quit-confirm-result', handleQuitConfirm)
    }, delay)
  })
}

app.on('window-all-closed', () => {
  // Don't quit app when all windows are closed
})

app.on('before-quit', async (e) => {
  if (!isQuitting && !notQuitDialog) {
    e.preventDefault()

    const now = Date.now()
    if (now - lastQuitAttempt < 500) {
      isQuitting = true
      if (quitTimeout) {
        clearTimeout(quitTimeout)
        quitTimeout = null
      }
      saveTrafficStats() // 退出前保存流量统计
      triggerSysProxy(false, false)
      await stopCore()
      app.exit()
      return
    }
    lastQuitAttempt = now

    const confirmed = await showQuitConfirmDialog()

    if (confirmed) {
      isQuitting = true
      if (quitTimeout) {
        clearTimeout(quitTimeout)
        quitTimeout = null
      }
      saveTrafficStats() // 退出前保存流量统计
      triggerSysProxy(false, false)
      await stopCore()
      app.exit()
    }
  } else if (notQuitDialog) {
    isQuitting = true
    if (quitTimeout) {
      clearTimeout(quitTimeout)
      quitTimeout = null
    }
    saveTrafficStats() // 退出前保存流量统计
    triggerSysProxy(false, false)
    await stopCore()
    app.exit()
  }
})

powerMonitor.on('shutdown', async () => {
  if (quitTimeout) {
    clearTimeout(quitTimeout)
    quitTimeout = null
  }
  triggerSysProxy(false, false)
  await stopCore()
  app.exit()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('routex.app')
  try {
    await initPromise
  } catch (e) {
    dialog.showErrorBox('应用初始化失败', `${e}`)
    app.quit()
  }

  // 加载流量统计数据
  loadTrafficStats()
  
  // 加载订阅统计数据
  loadProviderStats()
  startMapUpdateTimer()
  
  // 启动网络健康监控
  startNetworkHealthMonitor()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  const appConfig = await getAppConfig()
  const { showFloatingWindow: showFloating = false, disableTray = false } = appConfig
  registerIpcMainHandlers()

  const createWindowPromise = createWindow(appConfig)

  let coreStarted = false

  const coreStartPromise = (async (): Promise<void> => {
    try {
      const [startPromise] = await startCore()
      startPromise.then(async () => {
        await initProfileUpdater()
      })
      coreStarted = true
    } catch (e) {
      dialog.showErrorBox('内核启动出错', `${e}`)
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

  const uiTasks: Promise<void>[] = [initShortcut()]

  if (showFloating) {
    uiTasks.push(Promise.resolve(showFloatingWindow()))
  }
  if (!disableTray) {
    uiTasks.push(createTray())
  }

  await Promise.all(uiTasks)

  await Promise.all([coreStartPromise, monitorPromise])

  if (coreStarted) {
    mainWindow?.webContents.send('core-started')
    // 内核启动完成，开始记录订阅统计
    onCoreStarted()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    showMainWindow()
  })
})

async function handleDeepLink(url: string): Promise<void> {
  if (!url.startsWith('clash://') && !url.startsWith('mihomo://') && !url.startsWith('routex://'))
    return

  const urlObj = new URL(url)
  switch (urlObj.host) {
    case 'install-config': {
      try {
        const profileUrl = urlObj.searchParams.get('url')
        const profileName = urlObj.searchParams.get('name')
        if (!profileUrl) {
          throw new Error('缺少参数 url')
        }

        const confirmed = await showProfileInstallConfirm(profileUrl, profileName)

        if (confirmed) {
          await addProfileItem({
            type: 'remote',
            name: profileName ?? undefined,
            url: profileUrl
          })
          mainWindow?.webContents.send('profileConfigUpdated')
          new Notification({ title: '订阅导入成功' }).show()
        }
      } catch (e) {
        dialog.showErrorBox('订阅导入失败', `${url}\n${e}`)
      }
      break
    }
    case 'install-override': {
      try {
        const urlParam = urlObj.searchParams.get('url')
        const profileName = urlObj.searchParams.get('name')
        if (!urlParam) {
          throw new Error('缺少参数 url')
        }

        const confirmed = await showOverrideInstallConfirm(urlParam, profileName)

        if (confirmed) {
          const url = new URL(urlParam)
          const name = url.pathname.split('/').pop()
          await addOverrideItem({
            type: 'remote',
            name: profileName ?? (name ? decodeURIComponent(name) : undefined),
            url: urlParam,
            ext: url.pathname.endsWith('.js') ? 'js' : 'yaml'
          })
          mainWindow?.webContents.send('overrideConfigUpdated')
          new Notification({ title: '覆写导入成功' }).show()
        }
      } catch (e) {
        dialog.showErrorBox('覆写导入失败', `${url}\n${e}`)
      }
      break
    }
  }
}

async function showProfileInstallConfirm(url: string, name?: string | null): Promise<boolean> {
  if (!mainWindow) {
    await createWindow()
  }
  let extractedName = name

  if (!extractedName) {
    try {
      const axios = (await import('axios')).default
      const response = await axios.head(url, {
        headers: {
          'User-Agent': await getUserAgent()
        },
        timeout: 5000
      })

      if (response.headers['content-disposition']) {
        extractedName = parseFilename(response.headers['content-disposition'])
      }
    } catch (error) {
      // ignore
    }
  }

  return new Promise((resolve) => {
    const delay = showWindow()
    setTimeout(() => {
      mainWindow?.webContents.send('show-profile-install-confirm', {
        url,
        name: extractedName || name
      })
      const handleConfirm = (_event: Electron.IpcMainEvent, confirmed: boolean): void => {
        ipcMain.off('profile-install-confirm-result', handleConfirm)
        resolve(confirmed)
      }
      ipcMain.once('profile-install-confirm-result', handleConfirm)
    }, delay)
  })
}

function parseFilename(str: string): string {
  if (str.match(/filename\*=.*''/)) {
    const filename = decodeURIComponent(str.split(/filename\*=.*''/)[1])
    return filename
  } else {
    const filename = str.split('filename=')[1]
    return filename?.replace(/"/g, '') || ''
  }
}

async function showOverrideInstallConfirm(url: string, name?: string | null): Promise<boolean> {
  if (!mainWindow) {
    await createWindow()
  }
  return new Promise((resolve) => {
    let finalName = name
    if (!finalName) {
      const urlObj = new URL(url)
      const pathName = urlObj.pathname.split('/').pop()
      finalName = pathName ? decodeURIComponent(pathName) : undefined
    }

    const delay = showWindow()
    setTimeout(() => {
      mainWindow?.webContents.send('show-override-install-confirm', {
        url,
        name: finalName
      })
      const handleConfirm = (_event: Electron.IpcMainEvent, confirmed: boolean): void => {
        ipcMain.off('override-install-confirm-result', handleConfirm)
        resolve(confirmed)
      }
      ipcMain.once('override-install-confirm-result', handleConfirm)
    }, delay)
  })
}

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
      titleBarOverlay: useWindowFrame
        ? false
        : {
            height: 49
          },
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon: icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        spellcheck: false,
        sandbox: false
      }
    })
    mainWindowState.manage(mainWindow)
    mainWindow.on('ready-to-show', async () => {
      const { silentStart = false } = await getAppConfig()
      if (!silentStart) {
        if (quitTimeout) {
          clearTimeout(quitTimeout)
        }
        windowShown = true
        mainWindow?.show()
        mainWindow?.focusOnWebView()
      } else {
        await scheduleLightweightMode()
      }
    })
    mainWindow.webContents.on('did-fail-load', () => {
      mainWindow?.webContents.reload()
    })

    // 处理渲染进程崩溃
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('Renderer process crashed:', details)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reload()
      }
    })

    // 处理渲染进程无响应
    mainWindow.on('unresponsive', () => {
      console.warn('Main window became unresponsive')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reload()
      }
    })

    // 处理渲染进程恢复响应
    mainWindow.on('responsive', () => {
      console.log('Main window became responsive again')
    })

    mainWindow.on('close', async (event) => {
      event.preventDefault()
      mainWindow?.hide()
      if (windowShown) {
        await scheduleLightweightMode()
      }
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    mainWindow.on('resized', () => {
      if (mainWindow) mainWindowState.saveState(mainWindow)
    })

    mainWindow.on('unmaximize', () => {
      if (mainWindow) mainWindowState.saveState(mainWindow)
    })

    mainWindow.on('move', () => {
      if (mainWindow) mainWindowState.saveState(mainWindow)
    })

    mainWindow.on('session-end', async () => {
      triggerSysProxy(false, false)
      await stopCore()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })
    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
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
  if (quitTimeout) {
    clearTimeout(quitTimeout)
  }
  if (process.platform === 'darwin' && app.dock) {
    const { useDockIcon = true } = await getAppConfig()
    if (!useDockIcon) {
      app.dock.hide()
    }
  }
  if (mainWindow) {
    windowShown = true
    mainWindow.show()
    mainWindow.focusOnWebView()
    // 检查渲染进程是否正常，如果崩溃则重新加载
    if (mainWindow.webContents.isCrashed()) {
      mainWindow.webContents.reload()
    }
  } else {
    await createWindow()
    if (mainWindow !== null) {
      windowShown = true
      ;(mainWindow as BrowserWindow).show()
      ;(mainWindow as BrowserWindow).focusOnWebView()
    }
  }
}

export function closeMainWindow(): void {
  if (mainWindow) {
    mainWindow.close()
  }
}
