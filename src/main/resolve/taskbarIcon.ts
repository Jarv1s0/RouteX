import { BrowserWindow, ipcMain, screen } from 'electron'
import { tray } from './tray'
import { getIconPath } from '../utils/dirs'
import { getCachedNativeIcon } from '../utils/nativeIconCache'

type TaskbarIconType = 'default' | 'proxy' | 'tun'

let currentHandler:
  | ((event: Electron.IpcMainEvent, type: TaskbarIconType) => void)
  | null = null

export function registerTaskbarIconHandler(getMainWindow: () => BrowserWindow | null): void {
  if (currentHandler) {
    ipcMain.removeListener('update-taskbar-icon', currentHandler)
  }

  currentHandler = (_event, type) => {
    try {
      if (process.platform !== 'win32') return

      let iconName = 'icon.ico'
      if (type === 'proxy') iconName = 'icon_proxy.ico'
      if (type === 'tun') iconName = 'icon_tun.ico'

      const iconPath = getIconPath(iconName)
      const nativeIcon = getCachedNativeIcon(iconPath)

      if (nativeIcon.isEmpty()) {
        console.warn(`[IconUpdate] Failed to load icon from path: ${iconPath}`)
        return
      }

      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setIcon(nativeIcon)
      }

      if (tray) {
        const scaleFactor = screen.getPrimaryDisplay().scaleFactor
        const traySize = Math.round(16 * scaleFactor)
        const trayIcon = getCachedNativeIcon(iconPath, traySize, traySize)
        tray.setImage(trayIcon)
      }
    } catch (error) {
      console.error('Failed to update icons:', error)
    }
  }

  ipcMain.on('update-taskbar-icon', currentHandler)
}
