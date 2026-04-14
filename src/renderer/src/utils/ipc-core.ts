import { IPC_INVOKE_CHANNELS, type IpcInvokeChannel } from '../../../shared/ipc'
import { desktop } from '@renderer/api/desktop'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ipcErrorWrapper(response: any): any {
  if (response !== null && typeof response === 'object' && 'invokeError' in response) {
    throw response.invokeError
  }
  return response
}

const C = IPC_INVOKE_CHANNELS
let globalAlertInstalled = false

export { C }

export async function invokeSafe<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T> {
  return ipcErrorWrapper(await desktop.invoke<T>(channel, ...args))
}

export async function invokeRaw<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T> {
  return desktop.invoke<T>(channel, ...args)
}

export function installGlobalAlert(): void {
  if (globalAlertInstalled) {
    return
  }

  globalAlertInstalled = true
  window.alert = ((message?: unknown): void => {
    const content =
      message instanceof Error
        ? message.message || String(message)
        : typeof message === 'string'
          ? message
          : (() => {
              try {
                return JSON.stringify(message, null, 2)
              } catch {
                return String(message)
              }
            })()

    window.dispatchEvent(
      new CustomEvent('show-global-dialog', {
        detail: { type: 'info', title: '提示', content }
      })
    )
  }) as typeof window.alert
}
