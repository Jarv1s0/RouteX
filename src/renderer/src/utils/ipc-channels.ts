import type { DesktopIpcRendererEvent } from '../../../shared/types/desktop-bridge'
import {
  IPC_ON_CHANNELS,
  IPC_SEND_CHANNELS,
  type IpcOnChannel,
  type IpcSendChannel
} from '../../../shared/ipc'
import { desktop } from '@renderer/api/desktop'

export const ON = IPC_ON_CHANNELS
export const SEND = IPC_SEND_CHANNELS

type RendererListener<Args extends unknown[] = unknown[]> = (
  event: DesktopIpcRendererEvent,
  ...args: Args
) => void

export function onIpc<Args extends unknown[]>(
  channel: IpcOnChannel,
  listener: RendererListener<Args>
): () => void {
  return desktop.on(channel, listener)
}

export function onceIpc<Args extends unknown[]>(
  channel: IpcOnChannel,
  listener: RendererListener<Args>
): () => void {
  return desktop.once(channel, listener)
}

export function sendIpc(channel: IpcSendChannel, ...args: unknown[]): void {
  desktop.send(channel, ...args)
}
