import { IpcRendererEvent, webUtils } from 'electron'

type IpcRendererListener<Args extends unknown[] = unknown[]> = (
  event: IpcRendererEvent,
  ...args: Args
) => void

interface IpcRendererBridge {
  on<Args extends unknown[]>(channel: string, listener: IpcRendererListener<Args>): () => void
  once<Args extends unknown[]>(channel: string, listener: IpcRendererListener<Args>): () => void
  removeAllListeners(channel: string): void
  removeListener<Args extends unknown[]>(
    channel: string,
    listener: IpcRendererListener<Args>
  ): IpcRendererBridge
  send(channel: string, ...args: unknown[]): void
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>
  postMessage(channel: string, message: unknown, transfer?: MessagePort[]): void
  sendSync<T>(channel: string, ...args: unknown[]): T
  sendToHost(channel: string, ...args: unknown[]): void
}

interface WebFrameBridge {
  insertCSS(css: string): Promise<string> | string
  setZoomFactor(factor: number): void
  setZoomLevel(level: number): void
}

interface WebUtilsBridge {
  getPathForFile(file: File): string
}

interface ProcessBridge {
  readonly platform: NodeJS.Platform
  readonly versions: NodeJS.ProcessVersions
  readonly env: NodeJS.ProcessEnv
}

interface ElectronAPI {
  ipcRenderer: IpcRendererBridge
  webFrame: WebFrameBridge
  webUtils: WebUtilsBridge
  process: ProcessBridge
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: { webUtils: typeof webUtils; platform: NodeJS.Platform }
  }
}
