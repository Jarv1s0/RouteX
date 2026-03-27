import type { IpcRendererEvent } from 'electron'
import {
  IPC_ON_CHANNELS,
  IPC_SEND_CHANNELS,
  type IpcOnChannel,
  type IpcSendChannel
} from '../../../shared/ipc'

export const ON = IPC_ON_CHANNELS
export const SEND = IPC_SEND_CHANNELS

type RendererListener<Args extends unknown[] = unknown[]> = (
  event: IpcRendererEvent,
  ...args: Args
) => void

export function onIpc<Args extends unknown[]>(
  channel: IpcOnChannel,
  listener: RendererListener<Args>
): () => void {
  return window.electron.ipcRenderer.on(channel, listener)
}

export function onceIpc<Args extends unknown[]>(
  channel: IpcOnChannel,
  listener: RendererListener<Args>
): () => void {
  return window.electron.ipcRenderer.once(channel, listener)
}

export function sendIpc(channel: IpcSendChannel, ...args: unknown[]): void {
  window.electron.ipcRenderer.send(channel, ...args)
}
