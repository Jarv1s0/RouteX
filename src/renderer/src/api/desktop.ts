import type { DesktopIpcRendererEvent } from '../../../shared/types/desktop-bridge'
import type { IpcInvokeChannel, IpcOnChannel, IpcSendChannel } from '../../../shared/ipc'

export type DesktopListener<Args extends unknown[] = unknown[]> = (
  event: DesktopIpcRendererEvent,
  ...args: Args
) => void

interface DesktopApi {
  readonly platform: NodeJS.Platform
  getPathForFile(file: File): string
  invoke<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T>
  on<Args extends unknown[]>(channel: IpcOnChannel, listener: DesktopListener<Args>): () => void
  once<Args extends unknown[]>(channel: IpcOnChannel, listener: DesktopListener<Args>): () => void
  send(channel: IpcSendChannel, ...args: unknown[]): void
}

// ─── 缓存 Tauri API 模块引用，消除重复 import() 开销 ───
let _tauriCore: typeof import('@tauri-apps/api/core') | null = null
let _tauriCorePromise: Promise<typeof import('@tauri-apps/api/core')> | null = null
let _tauriEvent: typeof import('@tauri-apps/api/event') | null = null
let _tauriEventPromise: Promise<typeof import('@tauri-apps/api/event')> | null = null

function getTauriCore(): Promise<typeof import('@tauri-apps/api/core')> {
  if (_tauriCore) return Promise.resolve(_tauriCore)
  if (!_tauriCorePromise) {
    _tauriCorePromise = import('@tauri-apps/api/core').then(m => { _tauriCore = m; return m })
  }
  return _tauriCorePromise
}

function getTauriEvent(): Promise<typeof import('@tauri-apps/api/event')> {
  if (_tauriEvent) return Promise.resolve(_tauriEvent)
  if (!_tauriEventPromise) {
    _tauriEventPromise = import('@tauri-apps/api/event').then(m => { _tauriEvent = m; return m })
  }
  return _tauriEventPromise
}

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

interface TauriVirtualFileRecord {
  name: string
  text: Promise<string>
}

const TAURI_VIRTUAL_FILE_PREFIX = 'tauri-file:///'
const tauriVirtualFiles = new Map<string, TauriVirtualFileRecord>()

function createTauriVirtualFileToken(file: File): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
  const token = `${TAURI_VIRTUAL_FILE_PREFIX}${id}/${encodeURIComponent(file.name || 'file.txt')}`

  tauriVirtualFiles.set(token, {
    name: file.name || 'file.txt',
    text: file.text()
  })

  return token
}

function createSyntheticIpcEvent(): DesktopIpcRendererEvent {
  return { sender: null }
}

function readCustomEventArgs(event: Event): unknown[] {
  if (event instanceof CustomEvent) {
    return Array.isArray(event.detail) ? event.detail : event.detail === undefined ? [] : [event.detail]
  }

  return []
}

function getElectronBridge(): Window['electron'] {
  if (!window.electron?.ipcRenderer) {
    throw new Error('Desktop bridge is unavailable: window.electron.ipcRenderer is missing')
  }

  return window.electron
}

function getApiBridge(): Window['api'] {
  if (!window.api?.platform) {
    throw new Error('Desktop bridge is unavailable: window.api.platform is missing')
  }

  return window.api
}

function shouldLogDesktopInvoke(channel: string, durationMs: number): boolean {
  return durationMs >= 80 ||
    channel === 'getRuntimeConfig' ||
    channel === 'getRuntimeConfigStr' ||
    channel === 'mihomoRules' ||
    channel === 'mihomoRuleProviders' ||
    channel === 'mihomoProxyProviders'
}

function logDesktopInvoke(channel: string, durationMs: number, error?: unknown): void {
  if (!shouldLogDesktopInvoke(channel, durationMs)) {
    return
  }

  const rounded = durationMs.toFixed(1)
  if (error) {
    console.warn(`[desktop.invoke] ${channel} failed in ${rounded}ms`, error)
    return
  }

  console.info(`[desktop.invoke] ${channel} ${rounded}ms`)
}

export const desktop: DesktopApi = {
  get platform() {
    if (isTauriHost()) {
      return __ROUTEX_PLATFORM__
    }

    return getApiBridge().platform
  },
  getPathForFile(file) {
    if (isTauriHost()) {
      return createTauriVirtualFileToken(file)
    }

    return getApiBridge().webUtils.getPathForFile(file)
  },
  invoke: async <T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T> => {
    if (isTauriHost()) {
      const startedAt = performance.now()
      try {
        const { invoke } = await getTauriCore()
        const result =
          channel === 'checkUpdate'
            ? await invoke<T>('desktop_check_update')
            : channel === 'getIconDataURLs'
              ? await invoke<T>('desktop_get_icon_data_urls', {
                  appPaths: Array.isArray(args[0]) ? args[0] : []
                })
            : await invoke<T>('desktop_invoke', {
                channel,
                args
              })
        logDesktopInvoke(channel, performance.now() - startedAt)
        return result
      } catch (error) {
        logDesktopInvoke(channel, performance.now() - startedAt, error)
        throw error
      }
    }

    return getElectronBridge().ipcRenderer.invoke(channel, ...args)
  },
  on<Args extends unknown[]>(channel: IpcOnChannel, listener: DesktopListener<Args>) {
    if (isTauriHost()) {
      const localHandler = (event: Event): void => {
        listener(createSyntheticIpcEvent(), ...(readCustomEventArgs(event) as unknown as Args))
      }

      window.addEventListener(channel, localHandler)
      const unlistenPromise = getTauriEvent()
        .then(({ listen }) =>
          listen(channel, (event) => {
            const payload = Array.isArray(event.payload)
              ? event.payload
              : event.payload === undefined
                ? []
                : [event.payload]
            listener(createSyntheticIpcEvent(), ...(payload as unknown as Args))
          })
        )
        .catch(() => null)

      return () => {
        window.removeEventListener(channel, localHandler)
        void unlistenPromise.then((unlisten) => {
          if (typeof unlisten === 'function') {
            unlisten()
          }
        })
      }
    }

    return getElectronBridge().ipcRenderer.on(channel, listener)
  },
  once<Args extends unknown[]>(channel: IpcOnChannel, listener: DesktopListener<Args>) {
    if (isTauriHost()) {
      const localHandler = (event: Event): void => {
        listener(createSyntheticIpcEvent(), ...(readCustomEventArgs(event) as unknown as Args))
      }

      window.addEventListener(channel, localHandler, { once: true })
      const unlistenPromise = getTauriEvent()
        .then(({ once }) =>
          once(channel, (event) => {
            const payload = Array.isArray(event.payload)
              ? event.payload
              : event.payload === undefined
                ? []
                : [event.payload]
            listener(createSyntheticIpcEvent(), ...(payload as unknown as Args))
          })
        )
        .catch(() => null)

      return () => {
        window.removeEventListener(channel, localHandler)
        void unlistenPromise.then((unlisten) => {
          if (typeof unlisten === 'function') {
            unlisten()
          }
        })
      }
    }

    return getElectronBridge().ipcRenderer.once(channel, listener)
  },
  send(channel, ...args) {
    if (isTauriHost()) {
      const invokeChannelMap: Partial<Record<IpcSendChannel, string>> = {
        'customTray:close': 'closeTrayMenuWindow',
        'quit-confirm-result': 'quitConfirmResult',
        trayIconUpdate: 'trayIconUpdate',
        updateFloatingWindow: 'updateFloatingWindow',
        'update-taskbar-icon': 'updateTaskbarIcon',
        updateTrayMenu: 'updateTrayMenu'
      }

      const invokeChannel = invokeChannelMap[channel]
      if (invokeChannel) {
        void getTauriCore().then(({ invoke }) =>
          invoke('desktop_invoke', {
            channel: invokeChannel,
            args
          })
        )
      }
      return
    }

    getElectronBridge().ipcRenderer.send(channel, ...args)
  }
}

export function emitDesktopEvent(channel: IpcOnChannel, ...args: unknown[]): void {
  if (!isTauriHost()) {
    return
  }

  window.dispatchEvent(new CustomEvent(channel, { detail: args }))
}

export function isTauriVirtualFile(path: string): boolean {
  return path.startsWith(TAURI_VIRTUAL_FILE_PREFIX)
}

export async function readTauriVirtualFile(path: string): Promise<string | undefined> {
  const record = tauriVirtualFiles.get(path)
  return record ? await record.text : undefined
}

export async function pickTauriFiles(extensions: string[]): Promise<string[] | undefined> {
  if (!isTauriHost()) {
    return undefined
  }

  return await new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = extensions
      .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`))
      .join(',')

    let settled = false
    const finish = (value: string[] | undefined): void => {
      if (settled) {
        return
      }

      settled = true
      window.removeEventListener('focus', handleFocus, true)
      input.remove()
      resolve(value)
    }

    const handleFocus = (): void => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          finish(undefined)
        }
      }, 300)
    }

    input.addEventListener('change', () => {
      const files = Array.from(input.files || [])
      finish(files.length ? files.map(createTauriVirtualFileToken) : undefined)
    })

    window.addEventListener('focus', handleFocus, true)
    input.click()
  })
}
