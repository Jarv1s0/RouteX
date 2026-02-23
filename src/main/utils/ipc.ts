import { registerMihomoHandlers } from '../ipc/mihomo'
import { registerConfigHandlers } from '../ipc/config'
import { registerSystemHandlers } from '../ipc/system'
import { registerNetworkHandlers } from '../ipc/network'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ipcErrorWrapper<T>(
  fn: (...args: any[]) => Promise<T>
): (...args: any[]) => Promise<T | { invokeError: unknown }> {
  return async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e && typeof e === 'object') {
        if ('message' in e) {
          return { invokeError: e.message }
        } else {
          return { invokeError: JSON.stringify(e) }
        }
      }
      if (e instanceof Error || typeof e === 'string') {
        return { invokeError: e }
      }
      return { invokeError: 'Unknown Error' }
    }
  }
}

// 统一注册所有 IPC 处理器
export function registerIpcMainHandlers(): void {
  registerMihomoHandlers()
  registerConfigHandlers()
  registerSystemHandlers()
  registerNetworkHandlers()
}
