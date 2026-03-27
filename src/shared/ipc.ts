import { CONFIG_IPC_INVOKE_CHANNELS } from './ipc/invoke-config'
import { MIHOMO_IPC_INVOKE_CHANNELS } from './ipc/invoke-mihomo'
import { NETWORK_IPC_INVOKE_CHANNELS } from './ipc/invoke-network'
import { SYSTEM_IPC_INVOKE_CHANNELS } from './ipc/invoke-system'
import { IPC_SEND_CHANNELS } from './ipc/send-channels'
import { IPC_ON_CHANNELS } from './ipc/on-channels'

export const IPC_INVOKE_CHANNELS = {
  ...CONFIG_IPC_INVOKE_CHANNELS,
  ...MIHOMO_IPC_INVOKE_CHANNELS,
  ...NETWORK_IPC_INVOKE_CHANNELS,
  ...SYSTEM_IPC_INVOKE_CHANNELS
} as const

export type IpcInvokeChannel =
  (typeof IPC_INVOKE_CHANNELS)[keyof typeof IPC_INVOKE_CHANNELS]

export type IpcSendChannel =
  (typeof IPC_SEND_CHANNELS)[keyof typeof IPC_SEND_CHANNELS]

export type IpcOnChannel = (typeof IPC_ON_CHANNELS)[keyof typeof IPC_ON_CHANNELS]

export { IPC_SEND_CHANNELS, IPC_ON_CHANNELS }
