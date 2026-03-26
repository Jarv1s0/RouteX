import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

const electronAPI = {
  ipcRenderer: {
    send(channel: string, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args)
    },
    sendSync(channel: string, ...args: unknown[]) {
      return ipcRenderer.sendSync(channel, ...args)
    },
    sendToHost(channel: string, ...args: unknown[]) {
      ipcRenderer.sendToHost(channel, ...args)
    },
    postMessage(channel: string, message: unknown, transfer?: MessagePort[]) {
      ipcRenderer.postMessage(channel, message, transfer)
    },
    invoke(channel: string, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args)
    },
    on(channel: string, listener: (...args: unknown[]) => void) {
      ipcRenderer.on(channel, listener as Parameters<typeof ipcRenderer.on>[1])
      return () => {
        ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.on>[1])
      }
    },
    once(channel: string, listener: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, listener as Parameters<typeof ipcRenderer.once>[1])
      return () => {
        ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.once>[1])
      }
    },
    removeListener(channel: string, listener: (...args: unknown[]) => void) {
      ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.on>[1])
      return this
    },
    removeAllListeners(channel: string) {
      ipcRenderer.removeAllListeners(channel)
    }
  },
  webFrame: {
    insertCSS(css: string) {
      return webFrame.insertCSS(css)
    },
    setZoomFactor(factor: number) {
      if (typeof factor === 'number' && factor > 0) {
        webFrame.setZoomFactor(factor)
      }
    },
    setZoomLevel(level: number) {
      if (typeof level === 'number') {
        webFrame.setZoomLevel(level)
      }
    }
  },
  webUtils: {
    getPathForFile(file: File) {
      return webUtils.getPathForFile(file)
    }
  },
  process: {
    get platform() {
      return process.platform
    },
    get versions() {
      return process.versions
    }
  }
}

// Custom APIs for renderer
const api = {
  webUtils: webUtils,
  platform: process.platform
}
// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
