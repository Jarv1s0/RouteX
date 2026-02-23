import { app, dialog, ipcMain } from 'electron'
import {
  manualGrantCorePermition,
  quitWithoutCore,
  restartCore,
  startNetworkDetection,
  stopNetworkDetection,
  revokeCorePermission,
  checkCorePermission
} from '../core/manager'
import { triggerSysProxy } from '../sys/sysproxy'
import { checkUpdate, downloadAndInstallUpdate, cancelUpdate } from '../resolve/autoUpdater'
import {
  checkElevateTask,
  deleteElevateTask,
  getFilePath,
  saveFile,
  openFile,
  openUWPTool,
  readTextFile,
  resetAppConfig,
  setNativeTheme,
  setupFirewall
} from '../sys/misc'
import {
  serviceStatus,
  installService,
  uninstallService,
  startService,
  stopService,
  initService,
  testServiceConnection,
  restartService
} from '../service/manager'
import { findSystemMihomo } from '../utils/dirs'
import {
  getRuntimeConfig,
  getRuntimeConfigStr,
  getRawProfileStr,
  getCurrentProfileStr,
  getOverrideProfileStr
} from '../core/factory'
import { listWebdavBackups, webdavBackup, webdavDelete, webdavRestore } from '../resolve/backup'
import { getInterfaces } from '../sys/interface'
import { closeTrayIcon, copyEnv, setDockVisible, showTrayIcon } from '../resolve/tray'
import { registerShortcut } from '../resolve/shortcut'
import {
  closeMainWindow,
  mainWindow,
  setNotQuitDialog,
  showMainWindow,
  triggerMainWindow
} from '..'
import {
  applyTheme,
  fetchThemes,
  importThemes,
  readTheme,
  resolveThemes,
  writeTheme
} from '../resolve/theme'
import {
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore,
  subStoreFrontendPort,
  subStorePort
} from '../resolve/server'
import { subStoreCollections, subStoreSubs } from '../core/subStoreApi'
import { logDir } from '../utils/dirs'
import path from 'path'
import v8 from 'v8'
import { getGistUrl } from '../resolve/gistApi'
import { getIconDataURL, getImageDataURL } from '../utils/icon'
import { startMonitor } from '../resolve/trafficMonitor'
import { closeFloatingWindow, showContextMenu, showFloatingWindow } from '../resolve/floatingWindow'
import { getAppName } from '../utils/appName'
import { getUserAgent } from '../utils/userAgent'
import { getTrafficStats, clearTrafficStats, getProcessTrafficRanking } from '../resolve/trafficStats'
import { getProviderStats, clearProviderStats, triggerSnapshot } from '../resolve/providerStats'
import { startNetworkHealthMonitor, stopNetworkHealthMonitor, getNetworkHealthStats } from '../resolve/networkHealth'
import { ipcErrorWrapper } from '../utils/ipc'

// 系统、服务、窗口、主题及杂项 IPC 处理器
export function registerSystemHandlers(): void {
  ipcMain.handle('restartCore', ipcErrorWrapper(restartCore))
  ipcMain.handle('startMonitor', (_e, detached) => ipcErrorWrapper(startMonitor)(detached))
  ipcMain.handle('triggerSysProxy', (_e, enable, onlyActiveDevice) =>
    ipcErrorWrapper(triggerSysProxy)(enable, onlyActiveDevice)
  )
  ipcMain.handle('manualGrantCorePermition', (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
    ipcErrorWrapper(manualGrantCorePermition)(cores)
  )
  ipcMain.handle('checkCorePermission', () => ipcErrorWrapper(checkCorePermission)())
  ipcMain.handle('revokeCorePermission', (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
    ipcErrorWrapper(revokeCorePermission)(cores)
  )
  ipcMain.handle('checkElevateTask', () => ipcErrorWrapper(checkElevateTask)())
  ipcMain.handle('deleteElevateTask', () => ipcErrorWrapper(deleteElevateTask)())
  ipcMain.handle('serviceStatus', () => ipcErrorWrapper(serviceStatus)())
  ipcMain.handle('testServiceConnection', () => ipcErrorWrapper(testServiceConnection)())
  ipcMain.handle('initService', () => ipcErrorWrapper(initService)())
  ipcMain.handle('installService', () => ipcErrorWrapper(installService)())
  ipcMain.handle('uninstallService', () => ipcErrorWrapper(uninstallService)())
  ipcMain.handle('startService', () => ipcErrorWrapper(startService)())
  ipcMain.handle('restartService', () => ipcErrorWrapper(restartService)())
  ipcMain.handle('stopService', () => ipcErrorWrapper(stopService)())
  ipcMain.handle('findSystemMihomo', () => findSystemMihomo())
  ipcMain.handle('getFilePath', (_e, ext) => getFilePath(ext))
  ipcMain.handle('saveFile', (_e, content, defaultName, ext) => saveFile(content, defaultName, ext))
  ipcMain.handle('readTextFile', (_e, filePath) => ipcErrorWrapper(readTextFile)(filePath))
  ipcMain.handle('getRuntimeConfigStr', ipcErrorWrapper(getRuntimeConfigStr))
  ipcMain.handle('getRawProfileStr', ipcErrorWrapper(getRawProfileStr))
  ipcMain.handle('getCurrentProfileStr', ipcErrorWrapper(getCurrentProfileStr))
  ipcMain.handle('getOverrideProfileStr', ipcErrorWrapper(getOverrideProfileStr))
  ipcMain.handle('getRuntimeConfig', ipcErrorWrapper(getRuntimeConfig))
  ipcMain.handle('downloadAndInstallUpdate', (_e, version) =>
    ipcErrorWrapper(downloadAndInstallUpdate)(version)
  )
  ipcMain.handle('checkUpdate', ipcErrorWrapper(checkUpdate))
  ipcMain.handle('cancelUpdate', ipcErrorWrapper(cancelUpdate))
  ipcMain.handle('getVersion', () => app.getVersion())
  ipcMain.handle('platform', () => process.platform)
  ipcMain.handle('openUWPTool', ipcErrorWrapper(openUWPTool))
  ipcMain.handle('setupFirewall', ipcErrorWrapper(setupFirewall))
  ipcMain.handle('getInterfaces', getInterfaces)
  ipcMain.handle('webdavBackup', ipcErrorWrapper(webdavBackup))
  ipcMain.handle('webdavRestore', (_e, filename) => ipcErrorWrapper(webdavRestore)(filename))
  ipcMain.handle('listWebdavBackups', ipcErrorWrapper(listWebdavBackups))
  ipcMain.handle('webdavDelete', (_e, filename) => ipcErrorWrapper(webdavDelete)(filename))
  ipcMain.handle('registerShortcut', (_e, oldShortcut, newShortcut, action) =>
    ipcErrorWrapper(registerShortcut)(oldShortcut, newShortcut, action)
  )
  ipcMain.handle('startSubStoreFrontendServer', () =>
    ipcErrorWrapper(startSubStoreFrontendServer)()
  )
  ipcMain.handle('stopSubStoreFrontendServer', () => ipcErrorWrapper(stopSubStoreFrontendServer)())
  ipcMain.handle('startSubStoreBackendServer', () => ipcErrorWrapper(startSubStoreBackendServer)())
  ipcMain.handle('stopSubStoreBackendServer', () => ipcErrorWrapper(stopSubStoreBackendServer)())
  ipcMain.handle('downloadSubStore', () => ipcErrorWrapper(downloadSubStore)())
  ipcMain.handle('subStorePort', () => subStorePort)
  ipcMain.handle('subStoreFrontendPort', () => subStoreFrontendPort)
  ipcMain.handle('subStoreSubs', () => ipcErrorWrapper(subStoreSubs)())
  ipcMain.handle('subStoreCollections', () => ipcErrorWrapper(subStoreCollections)())
  ipcMain.handle('getGistUrl', ipcErrorWrapper(getGistUrl))
  ipcMain.handle('setNativeTheme', (_e, theme) => {
    setNativeTheme(theme)
  })
  ipcMain.handle('setTitleBarOverlay', (_e, overlay) =>
    ipcErrorWrapper(async (overlay): Promise<void> => {
      if (typeof mainWindow?.setTitleBarOverlay === 'function') {
        mainWindow.setTitleBarOverlay(overlay)
      }
    })(overlay)
  )
  ipcMain.handle('setAlwaysOnTop', (_e, alwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(alwaysOnTop)
  })
  ipcMain.handle('isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop()
  })
  ipcMain.handle('showTrayIcon', () => ipcErrorWrapper(showTrayIcon)())
  ipcMain.handle('closeTrayIcon', () => ipcErrorWrapper(closeTrayIcon)())
  ipcMain.handle('setDockVisible', (_e, visible: boolean) => setDockVisible(visible))
  ipcMain.handle('showMainWindow', showMainWindow)
  ipcMain.handle('closeMainWindow', closeMainWindow)
  ipcMain.handle('windowMin', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('windowMax', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('triggerMainWindow', triggerMainWindow)
  ipcMain.handle('showFloatingWindow', () => ipcErrorWrapper(showFloatingWindow)())
  ipcMain.handle('closeFloatingWindow', () => ipcErrorWrapper(closeFloatingWindow)())
  ipcMain.handle('showContextMenu', () => ipcErrorWrapper(showContextMenu)())
  ipcMain.handle('openFile', (_e, type, id, ext) => openFile(type, id, ext))
  ipcMain.handle('openDevTools', () => {
    mainWindow?.webContents.openDevTools()
  })
  ipcMain.handle('createHeapSnapshot', () => {
    v8.writeHeapSnapshot(path.join(logDir(), `${Date.now()}.heapsnapshot`))
  })
  ipcMain.handle('getUserAgent', () => ipcErrorWrapper(getUserAgent)())
  ipcMain.handle('getAppName', (_e, appPath) => ipcErrorWrapper(getAppName)(appPath))
  ipcMain.handle('getImageDataURL', (_e, url) => ipcErrorWrapper(getImageDataURL)(url))
  ipcMain.handle('getIconDataURL', (_e, appPath) => ipcErrorWrapper(getIconDataURL)(appPath))
  ipcMain.handle('getTrafficStats', () => getTrafficStats())
  ipcMain.handle('clearTrafficStats', () => clearTrafficStats())
  ipcMain.handle('getProcessTrafficRanking', (_e, type: 'session' | 'today', sortBy: 'upload' | 'download') => getProcessTrafficRanking(type, sortBy))
  ipcMain.handle('getProviderStats', () => getProviderStats())
  ipcMain.handle('clearProviderStats', () => clearProviderStats())
  ipcMain.handle('triggerProviderSnapshot', async () => {
    await triggerSnapshot()
    return getProviderStats()
  })
  // 主题
  ipcMain.handle('resolveThemes', () => ipcErrorWrapper(resolveThemes)())
  ipcMain.handle('fetchThemes', () => ipcErrorWrapper(fetchThemes)())
  ipcMain.handle('importThemes', (_e, file) => ipcErrorWrapper(importThemes)(file))
  ipcMain.handle('readTheme', (_e, theme) => ipcErrorWrapper(readTheme)(theme))
  ipcMain.handle('writeTheme', (_e, theme, css) => ipcErrorWrapper(writeTheme)(theme, css))
  ipcMain.handle('applyTheme', (_e, theme) => ipcErrorWrapper(applyTheme)(theme))
  ipcMain.handle('copyEnv', (_e, type) => ipcErrorWrapper(copyEnv)(type))
  ipcMain.handle('alert', (_e, msg) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      mainWindow.webContents.send('show-dialog-modal', 'warning', '提示', msg)
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else {
      dialog.showErrorBox('RouteX', msg)
    }
  })
  ipcMain.handle('resetAppConfig', resetAppConfig)
  ipcMain.handle('relaunchApp', () => {
    setNotQuitDialog()
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle('quitWithoutCore', ipcErrorWrapper(quitWithoutCore))
  ipcMain.handle('startNetworkDetection', ipcErrorWrapper(startNetworkDetection))
  ipcMain.handle('stopNetworkDetection', ipcErrorWrapper(stopNetworkDetection))
  ipcMain.handle('quitApp', () => app.quit())
  ipcMain.handle('notDialogQuit', () => {
    setNotQuitDialog()
    app.quit()
  })
  // 网络健康监控
  ipcMain.handle('startNetworkHealthMonitor', () => {
    startNetworkHealthMonitor()
  })
  ipcMain.handle('stopNetworkHealthMonitor', () => {
    stopNetworkHealthMonitor()
  })
  ipcMain.handle('getNetworkHealthStats', () => {
    return getNetworkHealthStats()
  })
  ipcMain.handle('getAppUptime', () => process.uptime())
  ipcMain.handle('getAppMemory', async () => {
    const metrics = await process.getProcessMemoryInfo()
    return metrics.private
  })
}
