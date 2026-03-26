import { BrowserWindow, Notification, dialog, ipcMain } from 'electron'
import { addOverrideItem, addProfileItem } from '../config'
import { getUserAgent } from '../utils/userAgent'

interface DeepLinkControllerOptions {
  createWindow: () => Promise<void>
  getMainWindow: () => BrowserWindow | null
  showWindow: () => number
}

function getWindowOrThrow(getMainWindow: () => BrowserWindow | null): BrowserWindow {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('主窗口不可用')
  }
  return mainWindow
}

async function ensureWindowReady(options: DeepLinkControllerOptions): Promise<BrowserWindow> {
  const currentWindow = options.getMainWindow()
  if (currentWindow && !currentWindow.isDestroyed()) {
    return currentWindow
  }

  await options.createWindow()
  return getWindowOrThrow(options.getMainWindow)
}

function waitForRendererConfirm(
  responseChannel: string,
  resolve: (confirmed: boolean) => void
): void {
  ipcMain.once(responseChannel, (_event: Electron.IpcMainEvent, confirmed: boolean) => {
    resolve(confirmed)
  })
}

function parseFilename(value: string): string {
  if (value.match(/filename\*=.*''/)) {
    return decodeURIComponent(value.split(/filename\*=.*''/)[1])
  }

  return value.split('filename=')[1]?.replace(/"/g, '') || ''
}

async function showProfileInstallConfirm(
  options: DeepLinkControllerOptions,
  url: string,
  name?: string | null
): Promise<boolean> {
  await ensureWindowReady(options)
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
    } catch {
      // 忽略文件名探测失败，继续展示原始参数
    }
  }

  return new Promise((resolve) => {
    const delay = options.showWindow()
    setTimeout(() => {
      options.getMainWindow()?.webContents.send('show-profile-install-confirm', {
        url,
        name: extractedName || name
      })
      waitForRendererConfirm('profile-install-confirm-result', resolve)
    }, delay)
  })
}

async function showOverrideInstallConfirm(
  options: DeepLinkControllerOptions,
  url: string,
  name?: string | null
): Promise<boolean> {
  await ensureWindowReady(options)

  return new Promise((resolve) => {
    let finalName = name
    if (!finalName) {
      const urlObj = new URL(url)
      const pathName = urlObj.pathname.split('/').pop()
      finalName = pathName ? decodeURIComponent(pathName) : undefined
    }

    const delay = options.showWindow()
    setTimeout(() => {
      options.getMainWindow()?.webContents.send('show-override-install-confirm', {
        url,
        name: finalName
      })
      waitForRendererConfirm('override-install-confirm-result', resolve)
    }, delay)
  })
}

export function createDeepLinkHandler(options: DeepLinkControllerOptions) {
  return async function handleDeepLink(url: string): Promise<void> {
    if (
      !url.startsWith('clash://') &&
      !url.startsWith('mihomo://') &&
      !url.startsWith('routex://')
    ) {
      return
    }

    const urlObj = new URL(url)
    switch (urlObj.host) {
      case 'install-config': {
        try {
          const profileUrl = urlObj.searchParams.get('url')
          const profileName = urlObj.searchParams.get('name')
          if (!profileUrl) {
            throw new Error('缺少参数 url')
          }

          const confirmed = await showProfileInstallConfirm(options, profileUrl, profileName)

          if (confirmed) {
            await addProfileItem({
              type: 'remote',
              name: profileName ?? undefined,
              url: profileUrl
            })
            options.getMainWindow()?.webContents.send('profileConfigUpdated')
            new Notification({ title: '订阅导入成功' }).show()
          }
        } catch (error) {
          dialog.showErrorBox('订阅导入失败', `${url}\n${error}`)
        }
        break
      }
      case 'install-override': {
        try {
          const overrideUrl = urlObj.searchParams.get('url')
          const profileName = urlObj.searchParams.get('name')
          if (!overrideUrl) {
            throw new Error('缺少参数 url')
          }

          const confirmed = await showOverrideInstallConfirm(options, overrideUrl, profileName)

          if (confirmed) {
            const overrideUrlObject = new URL(overrideUrl)
            const filename = overrideUrlObject.pathname.split('/').pop()
            await addOverrideItem({
              type: 'remote',
              name: profileName ?? (filename ? decodeURIComponent(filename) : undefined),
              url: overrideUrl,
              ext: overrideUrlObject.pathname.endsWith('.js') ? 'js' : 'yaml'
            })
            options.getMainWindow()?.webContents.send('overrideConfigUpdated')
            new Notification({ title: '覆写导入成功' }).show()
          }
        } catch (error) {
          dialog.showErrorBox('覆写导入失败', `${url}\n${error}`)
        }
        break
      }
    }
  }
}
