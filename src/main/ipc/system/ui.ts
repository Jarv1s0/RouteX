import { app, dialog, shell } from 'electron'
import { checkUpdate, downloadAndInstallUpdate, cancelUpdate } from '../../resolve/autoUpdater'
import {
  resetAppConfig,
  setNativeTheme
} from '../../sys/misc'
import { closeTrayIcon, copyEnv, setDockVisible, showTrayIcon } from '../../resolve/tray'
import { registerShortcut } from '../../resolve/shortcut'
import {
  closeMainWindow,
  mainWindow,
  setNotQuitDialog,
  showMainWindow,
  triggerMainWindow
} from '../..'
import {
  applyTheme,
  fetchThemes,
  importThemes,
  readTheme,
  resolveThemes,
  writeTheme
} from '../../resolve/theme'
import { closeFloatingWindow, showContextMenu, showFloatingWindow } from '../../resolve/floatingWindow'
import { ipcErrorWrapper, type IpcInvokeHandlerMap } from '../../utils/ipc'
import { IPC_INVOKE_CHANNELS, IPC_ON_CHANNELS } from '../../../shared/ipc'
import { getDisplayVersion } from '../../utils/version'
import { getAxios } from '../../core/mihomoApi'

export function createUiHandlers(): IpcInvokeHandlerMap {
  const C = IPC_INVOKE_CHANNELS

  return {
    [C.downloadAndInstallUpdate]: (_e, version) => ipcErrorWrapper(downloadAndInstallUpdate)(version),
    [C.checkUpdate]: () => ipcErrorWrapper(checkUpdate)(),
    [C.cancelUpdate]: () => ipcErrorWrapper(cancelUpdate)(),
    [C.getVersion]: () => getDisplayVersion(),
    [C.platform]: () => process.platform,
    [C.getControllerUrl]: async () => {
      const axios = await getAxios()
      return axios.defaults.socketPath || null
    },
    [C.registerShortcut]: (_e, oldShortcut, newShortcut, action) =>
      ipcErrorWrapper(registerShortcut)(oldShortcut, newShortcut, action),
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
    [C.openDevTools]: () => {
      mainWindow?.webContents.openDevTools()
    },
    [C.openExternalUrl]: (_e, url: string) => ipcErrorWrapper(shell.openExternal)(url),
    [C.resolveThemes]: () => ipcErrorWrapper(resolveThemes)(),
    [C.fetchThemes]: () => ipcErrorWrapper(fetchThemes)(),
    [C.importThemes]: (_e, file) => ipcErrorWrapper(importThemes)(file),
    [C.readTheme]: (_e, theme) => ipcErrorWrapper(readTheme)(theme),
    [C.writeTheme]: (_e, theme, css) => ipcErrorWrapper(writeTheme)(theme, css),
    [C.applyTheme]: (_e, theme) => ipcErrorWrapper(applyTheme)(theme),
    [C.copyEnv]: (_e, type) => ipcErrorWrapper(copyEnv)(type),
    [C.alert]: (_e, msg) => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.webContents.send(IPC_ON_CHANNELS.showDialogModal, 'warning', '提示', msg)
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
    [C.quitApp]: () => app.quit(),
    [C.notDialogQuit]: () => {
      setNotQuitDialog()
      app.quit()
    }
  }
}
