import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  IPC_INVOKE_CHANNELS,
  IPC_ON_CHANNELS,
  IPC_SEND_CHANNELS,
  type IpcInvokeChannel,
  type IpcOnChannel,
  type IpcSendChannel
} from '../shared/ipc'

const ALLOWED_SEND_CHANNELS = new Set<IpcSendChannel>(Object.values(IPC_SEND_CHANNELS))
const ALLOWED_ON_CHANNELS = new Set<IpcOnChannel>(Object.values(IPC_ON_CHANNELS))
const ALLOWED_INVOKE_CHANNELS = new Set<IpcInvokeChannel>(Object.values(IPC_INVOKE_CHANNELS))

function assertSendChannel(channel: string): asserts channel is IpcSendChannel {
  if (!ALLOWED_SEND_CHANNELS.has(channel as IpcSendChannel)) {
    throw new Error(`Blocked ipcRenderer.send channel: ${channel}`)
  }
}

function assertOnChannel(channel: string): asserts channel is IpcOnChannel {
  if (!ALLOWED_ON_CHANNELS.has(channel as IpcOnChannel)) {
    throw new Error(`Blocked ipcRenderer listener channel: ${channel}`)
  }
}

function assertInvokeChannel(channel: string): asserts channel is IpcInvokeChannel {
  if (!ALLOWED_INVOKE_CHANNELS.has(channel as IpcInvokeChannel)) {
    throw new Error(`Blocked ipcRenderer.invoke channel: ${channel}`)
  }
}

const electronAPI = {
  ipcRenderer: {
    send(channel: IpcSendChannel, ...args: unknown[]) {
      assertSendChannel(channel)
      ipcRenderer.send(channel, ...args)
    },
    invoke(channel: IpcInvokeChannel, ...args: unknown[]) {
      assertInvokeChannel(channel)
      return ipcRenderer.invoke(channel, ...args)
    },
    on(channel: IpcOnChannel, listener: (...args: unknown[]) => void) {
      assertOnChannel(channel)
      ipcRenderer.on(channel, listener as Parameters<typeof ipcRenderer.on>[1])
      return () => {
        ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.on>[1])
      }
    },
    once(channel: IpcOnChannel, listener: (...args: unknown[]) => void) {
      assertOnChannel(channel)
      ipcRenderer.once(channel, listener as Parameters<typeof ipcRenderer.once>[1])
      return () => {
        ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.once>[1])
      }
    },
    removeListener(channel: IpcOnChannel, listener: (...args: unknown[]) => void) {
      assertOnChannel(channel)
      ipcRenderer.removeListener(channel, listener as Parameters<typeof ipcRenderer.on>[1])
      return this
    }
  }
}

// Custom APIs for renderer
const api = {
  webUtils: {
    getPathForFile(file: File) {
      return webUtils.getPathForFile(file)
    }
  },
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
