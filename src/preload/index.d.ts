import { IpcRendererEvent } from 'electron'
import type { IpcInvokeChannel, IpcOnChannel, IpcSendChannel } from '../shared/ipc'

type IpcRendererListener<Args extends unknown[] = unknown[]> = (
  event: IpcRendererEvent,
  ...args: Args
) => void

interface IpcRendererBridge {
  on<Args extends unknown[]>(channel: IpcOnChannel, listener: IpcRendererListener<Args>): () => void
  once<Args extends unknown[]>(channel: IpcOnChannel, listener: IpcRendererListener<Args>): () => void
  removeListener<Args extends unknown[]>(
    channel: IpcOnChannel,
    listener: IpcRendererListener<Args>
  ): IpcRendererBridge
  send(channel: IpcSendChannel, ...args: unknown[]): void
  invoke<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T>
}

interface ElectronAPI {
  ipcRenderer: IpcRendererBridge
}

interface RendererApiBridge {
  webUtils: {
    getPathForFile(file: File): string
  }
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererApiBridge
  }
}
