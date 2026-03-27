import { app, dialog } from 'electron'
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
  ensureSubStoreBackendServer,
  ensureSubStoreFrontendServer,
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
import { getProviderStats, clearProviderStats } from '../resolve/providerStats'
import { startNetworkHealthMonitor, stopNetworkHealthMonitor, getNetworkHealthStats } from '../resolve/networkHealth'
import { ipcErrorWrapper, registerIpcInvokeHandlers } from '../utils/ipc'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import { getDisplayVersion } from '../utils/version'

// 系统、服务、窗口、主题及杂项 IPC 处理器
export function registerSystemHandlers(): void {
  const C = IPC_INVOKE_CHANNELS

  registerIpcInvokeHandlers({
    [C.restartCore]: ipcErrorWrapper(restartCore),
    [C.startMonitor]: (_e, detached) => ipcErrorWrapper(startMonitor)(detached),
    [C.triggerSysProxy]: (_e, enable, onlyActiveDevice) =>
      ipcErrorWrapper(triggerSysProxy)(enable, onlyActiveDevice),
    [C.manualGrantCorePermition]: (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
      ipcErrorWrapper(manualGrantCorePermition)(cores),
    [C.checkCorePermission]: () => ipcErrorWrapper(checkCorePermission)(),
    [C.revokeCorePermission]: (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
      ipcErrorWrapper(revokeCorePermission)(cores),
    [C.checkElevateTask]: () => ipcErrorWrapper(checkElevateTask)(),
    [C.deleteElevateTask]: () => ipcErrorWrapper(deleteElevateTask)(),
    [C.serviceStatus]: () => ipcErrorWrapper(serviceStatus)(),
    [C.testServiceConnection]: () => ipcErrorWrapper(testServiceConnection)(),
    [C.initService]: () => ipcErrorWrapper(initService)(),
    [C.installService]: () => ipcErrorWrapper(installService)(),
    [C.uninstallService]: () => ipcErrorWrapper(uninstallService)(),
    [C.startService]: () => ipcErrorWrapper(startService)(),
    [C.restartService]: () => ipcErrorWrapper(restartService)(),
    [C.stopService]: () => ipcErrorWrapper(stopService)(),
    [C.findSystemMihomo]: () => findSystemMihomo(),
    [C.getFilePath]: (_e, ext) => getFilePath(ext),
    [C.saveFile]: (_e, content, defaultName, ext) => saveFile(content, defaultName, ext),
    [C.readTextFile]: (_e, filePath) => ipcErrorWrapper(readTextFile)(filePath),
    [C.getRuntimeConfigStr]: ipcErrorWrapper(getRuntimeConfigStr),
    [C.getRawProfileStr]: ipcErrorWrapper(getRawProfileStr),
    [C.getCurrentProfileStr]: ipcErrorWrapper(getCurrentProfileStr),
    [C.getOverrideProfileStr]: ipcErrorWrapper(getOverrideProfileStr),
    [C.getRuntimeConfig]: ipcErrorWrapper(getRuntimeConfig),
    [C.downloadAndInstallUpdate]: (_e, version) => ipcErrorWrapper(downloadAndInstallUpdate)(version),
    [C.checkUpdate]: ipcErrorWrapper(checkUpdate),
    [C.cancelUpdate]: ipcErrorWrapper(cancelUpdate),
    [C.getVersion]: () => getDisplayVersion(),
    [C.platform]: () => process.platform,
    [C.openUWPTool]: ipcErrorWrapper(openUWPTool),
    [C.setupFirewall]: ipcErrorWrapper(setupFirewall),
    [C.getInterfaces]: getInterfaces,
    [C.webdavBackup]: ipcErrorWrapper(webdavBackup),
    [C.webdavRestore]: (_e, filename) => ipcErrorWrapper(webdavRestore)(filename),
    [C.listWebdavBackups]: ipcErrorWrapper(listWebdavBackups),
    [C.webdavDelete]: (_e, filename) => ipcErrorWrapper(webdavDelete)(filename),
    [C.registerShortcut]: (_e, oldShortcut, newShortcut, action) =>
      ipcErrorWrapper(registerShortcut)(oldShortcut, newShortcut, action),
    [C.startSubStoreFrontendServer]: () => ipcErrorWrapper(startSubStoreFrontendServer)(),
    [C.stopSubStoreFrontendServer]: () => ipcErrorWrapper(stopSubStoreFrontendServer)(),
    [C.startSubStoreBackendServer]: () => ipcErrorWrapper(startSubStoreBackendServer)(),
    [C.stopSubStoreBackendServer]: () => ipcErrorWrapper(stopSubStoreBackendServer)(),
    [C.downloadSubStore]: () => ipcErrorWrapper(downloadSubStore)(),
    [C.subStorePort]: async () => {
      await ensureSubStoreBackendServer()
      return subStorePort
    },
    [C.subStoreFrontendPort]: async () => {
      await ensureSubStoreFrontendServer()
      return subStoreFrontendPort
    },
    [C.subStoreSubs]: () => ipcErrorWrapper(subStoreSubs)(),
    [C.subStoreCollections]: () => ipcErrorWrapper(subStoreCollections)(),
    [C.getGistUrl]: ipcErrorWrapper(getGistUrl),
    [C.setNativeTheme]: (_e, theme) => {
      setNativeTheme(theme)
    },
    [C.setTitleBarOverlay]: (_e, overlay) =>
      ipcErrorWrapper(async (overlay): Promise<void> => {
        if (typeof mainWindow?.setTitleBarOverlay === 'function') {
          mainWindow.setTitleBarOverlay(overlay)
        }
      })(overlay),
    [C.setAlwaysOnTop]: (_e, alwaysOnTop) => {
      mainWindow?.setAlwaysOnTop(alwaysOnTop)
    },
    [C.isAlwaysOnTop]: () => mainWindow?.isAlwaysOnTop(),
    [C.showTrayIcon]: () => ipcErrorWrapper(showTrayIcon)(),
    [C.closeTrayIcon]: () => ipcErrorWrapper(closeTrayIcon)(),
    [C.setDockVisible]: (_e, visible: boolean) => setDockVisible(visible),
    [C.showMainWindow]: showMainWindow,
    [C.closeMainWindow]: closeMainWindow,
    [C.windowMin]: () => {
      mainWindow?.minimize()
    },
    [C.windowMax]: () => {
      if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow?.maximize()
      }
    },
    [C.triggerMainWindow]: triggerMainWindow,
    [C.showFloatingWindow]: () => ipcErrorWrapper(showFloatingWindow)(),
    [C.closeFloatingWindow]: () => ipcErrorWrapper(closeFloatingWindow)(),
    [C.showContextMenu]: () => ipcErrorWrapper(showContextMenu)(),
    [C.openFile]: (_e, type, id, ext) => openFile(type, id, ext),
    [C.openDevTools]: () => {
      mainWindow?.webContents.openDevTools()
    },
    [C.createHeapSnapshot]: () => {
      v8.writeHeapSnapshot(path.join(logDir(), `${Date.now()}.heapsnapshot`))
    },
    [C.getUserAgent]: () => ipcErrorWrapper(getUserAgent)(),
    [C.getAppName]: (_e, appPath) => ipcErrorWrapper(getAppName)(appPath),
    [C.getImageDataURL]: (_e, url) => ipcErrorWrapper(getImageDataURL)(url),
    [C.getIconDataURL]: (_e, appPath) => ipcErrorWrapper(getIconDataURL)(appPath),
    [C.getTrafficStats]: () => getTrafficStats(),
    [C.clearTrafficStats]: () => clearTrafficStats(),
    [C.getProcessTrafficRanking]: (_e, type: 'session' | 'today', sortBy: 'upload' | 'download') =>
      getProcessTrafficRanking(type, sortBy),
    [C.getProviderStats]: () => getProviderStats(),
    [C.clearProviderStats]: () => clearProviderStats(),
    [C.resolveThemes]: () => ipcErrorWrapper(resolveThemes)(),
    [C.fetchThemes]: () => ipcErrorWrapper(fetchThemes)(),
    [C.importThemes]: (_e, file) => ipcErrorWrapper(importThemes)(file),
    [C.readTheme]: (_e, theme) => ipcErrorWrapper(readTheme)(theme),
    [C.writeTheme]: (_e, theme, css) => ipcErrorWrapper(writeTheme)(theme, css),
    [C.applyTheme]: (_e, theme) => ipcErrorWrapper(applyTheme)(theme),
    [C.copyEnv]: (_e, type) => ipcErrorWrapper(copyEnv)(type),
    [C.alert]: (_e, msg) => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.webContents.send('show-dialog-modal', 'warning', '提示', msg)
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      } else {
        dialog.showErrorBox('RouteX', msg)
      }
    },
    [C.resetAppConfig]: resetAppConfig,
    [C.relaunchApp]: () => {
      setNotQuitDialog()
      app.relaunch()
      app.exit(0)
    },
    [C.quitWithoutCore]: ipcErrorWrapper(quitWithoutCore),
    [C.startNetworkDetection]: ipcErrorWrapper(startNetworkDetection),
    [C.stopNetworkDetection]: ipcErrorWrapper(stopNetworkDetection),
    [C.quitApp]: () => app.quit(),
    [C.notDialogQuit]: () => {
      setNotQuitDialog()
      app.quit()
    },
    [C.startNetworkHealthMonitor]: () => {
      startNetworkHealthMonitor()
    },
    [C.stopNetworkHealthMonitor]: () => {
      stopNetworkHealthMonitor()
    },
    [C.getNetworkHealthStats]: () => getNetworkHealthStats(),
    [C.getAppUptime]: () => process.uptime(),
    [C.getAppMemory]: async () => {
      const metrics = await process.getProcessMemoryInfo()
      return metrics.private
    }
  })
}
