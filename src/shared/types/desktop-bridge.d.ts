import type { IpcInvokeChannel, IpcOnChannel, IpcSendChannel } from '../ipc'

export interface DesktopIpcRendererEvent {
  sender: unknown | null
}

export interface DesktopTitleBarOverlayOptions {
  color?: string
  symbolColor?: string
  height?: number
}

type DesktopIpcRendererListener<Args extends unknown[] = unknown[]> = (
  event: DesktopIpcRendererEvent,
  ...args: Args
) => void

interface DesktopIpcRendererBridge {
  on<Args extends unknown[]>(
    channel: IpcOnChannel,
    listener: DesktopIpcRendererListener<Args>
  ): () => void
  once<Args extends unknown[]>(
    channel: IpcOnChannel,
    listener: DesktopIpcRendererListener<Args>
  ): () => void
  removeListener<Args extends unknown[]>(
    channel: IpcOnChannel,
    listener: DesktopIpcRendererListener<Args>
  ): DesktopIpcRendererBridge
  send(channel: IpcSendChannel, ...args: unknown[]): void
  invoke<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T>
}

interface DesktopElectronBridge {
  ipcRenderer: DesktopIpcRendererBridge
}

interface DesktopApiBridge {
  webUtils: {
    getPathForFile(file: File): string
  }
  platform: NodeJS.Platform
}

declare global {
  namespace Electron {
    type IpcRendererEvent = DesktopIpcRendererEvent

    interface WebviewTag extends HTMLElement {
      src: string
    }
  }

  interface Window {
    electron: DesktopElectronBridge
    api: DesktopApiBridge
  }
}

export {}
