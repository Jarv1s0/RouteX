import { IpcRendererEvent, webUtils } from 'electron'

type IpcRendererListener = (event: IpcRendererEvent, ...args: any[]) => void

interface IpcRendererBridge {
  on(channel: string, listener: IpcRendererListener): () => void
  once(channel: string, listener: IpcRendererListener): () => void
  removeAllListeners(channel: string): void
  removeListener(channel: string, listener: IpcRendererListener): IpcRendererBridge
  send(channel: string, ...args: any[]): void
  invoke(channel: string, ...args: any[]): Promise<any>
  postMessage(channel: string, message: any, transfer?: MessagePort[]): void
  sendSync(channel: string, ...args: any[]): any
  sendToHost(channel: string, ...args: any[]): void
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
