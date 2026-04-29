import { C, invokeSafe } from '@renderer/utils/ipc-core'
import { emitDesktopEvent } from '@renderer/api/desktop'
import { IPC_ON_CHANNELS } from '../../../shared/ipc'
import { createDefaultAppConfig } from '../../../shared/defaults/app'
import { stopTauriMihomoEventBridge } from '@renderer/utils/mihomo-ipc'

let tauriAppConfigCache: AppConfig | null = null
let tauriAppConfigPromise: Promise<AppConfig> | null = null
let checkUpdatePromise: Promise<AppVersion | undefined> | null = null
let lastCheckUpdateAt = 0
let lastCheckUpdateResult: AppVersion | undefined

const CHECK_UPDATE_CACHE_MS = 60 * 1000

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeAppConfig<T>(target: T, patch: Partial<T>): T {
  const result = structuredClone(target)

  const mergeInto = (base: Record<string, unknown>, source: Record<string, unknown>) => {
    Object.entries(source).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(base[key])) {
        mergeInto(base[key] as Record<string, unknown>, value)
        return
      }

      base[key] = value
    })
  }

  mergeInto(result as Record<string, unknown>, patch as Record<string, unknown>)
  return result
}

function getDefaultTauriAppConfig(): AppConfig {
  return createDefaultAppConfig(__ROUTEX_PLATFORM__)
}

function normalizeTauriAppConfig(config?: Partial<AppConfig>): AppConfig {
  return mergeAppConfig(getDefaultTauriAppConfig(), config || {})
}

export async function checkAutoRun(): Promise<boolean> {
  return invokeSafe(C.checkAutoRun)
}

export async function enableAutoRun(): Promise<void> {
  return invokeSafe(C.enableAutoRun)
}

export async function disableAutoRun(): Promise<void> {
  return invokeSafe(C.disableAutoRun)
}

export async function getAppConfig(force = false): Promise<AppConfig> {
  if (isTauriHost()) {
    if (!force && tauriAppConfigCache) {
      return tauriAppConfigCache
    }

    if (!force && tauriAppConfigPromise) {
      return tauriAppConfigPromise
    }

    const request = invokeSafe<Partial<AppConfig>>(C.getAppConfig, force)
      .then((config) => {
        const normalized = normalizeTauriAppConfig(config)
        tauriAppConfigCache = normalized
        return normalized
      })
      .finally(() => {
        if (tauriAppConfigPromise === request) {
          tauriAppConfigPromise = null
        }
      })

    tauriAppConfigPromise = request
    return request
  }

  return invokeSafe(C.getAppConfig, force)
}

export async function patchAppConfig(patch: Partial<AppConfig>): Promise<void> {
  if (isTauriHost()) {
    await invokeSafe(C.patchAppConfig, patch)
    tauriAppConfigPromise = null
    tauriAppConfigCache = mergeAppConfig(tauriAppConfigCache || getDefaultTauriAppConfig(), patch)
    window.dispatchEvent(new CustomEvent('routex:app-config-updated'))
    emitDesktopEvent(IPC_ON_CHANNELS.appConfigUpdated)
    return
  }

  return invokeSafe(C.patchAppConfig, patch)
}

export async function checkUpdate(): Promise<AppVersion | undefined> {
  const now = Date.now()
  if (now - lastCheckUpdateAt < CHECK_UPDATE_CACHE_MS && lastCheckUpdateResult !== undefined) {
    return lastCheckUpdateResult
  }

  if (checkUpdatePromise) {
    return checkUpdatePromise
  }

  checkUpdatePromise = invokeSafe<AppVersion | undefined>(C.checkUpdate)
    .then((result) => {
      lastCheckUpdateAt = Date.now()
      lastCheckUpdateResult = result
      return result
    })
    .finally(() => {
      checkUpdatePromise = null
    })

  return checkUpdatePromise
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  return invokeSafe(C.downloadAndInstallUpdate, version)
}

export async function cancelUpdate(): Promise<void> {
  return invokeSafe(C.cancelUpdate)
}

export async function getVersion(): Promise<string> {
  return invokeSafe(C.getVersion)
}

export async function getPlatform(): Promise<NodeJS.Platform> {
  return invokeSafe(C.platform)
}

export async function relaunchApp(): Promise<void> {
  return invokeSafe(C.relaunchApp)
}

export async function quitWithoutCore(): Promise<void> {
  return invokeSafe(C.quitWithoutCore)
}

export async function quitApp(): Promise<void> {
  return invokeSafe(C.quitApp)
}

export async function notDialogQuit(): Promise<void> {
  return invokeSafe(C.notDialogQuit)
}

export async function openDevTools(): Promise<void> {
  return invokeSafe(C.openDevTools)
}

export async function openExternalUrl(url: string): Promise<void> {
  return invokeSafe(C.openExternalUrl, url)
}

export async function openConfigDir(): Promise<void> {
  return invokeSafe(C.openConfigDir)
}

export async function resetAppConfig(): Promise<void> {
  if (isTauriHost()) {
    await invokeSafe(C.resetAppConfig)
    tauriAppConfigPromise = null
    tauriAppConfigCache = getDefaultTauriAppConfig()
    stopTauriMihomoEventBridge()
    window.dispatchEvent(new CustomEvent('routex:app-config-updated'))
    window.dispatchEvent(new CustomEvent('routex:controled-mihomo-config-updated'))
    window.dispatchEvent(new CustomEvent('routex:profile-config-updated'))
    window.dispatchEvent(new CustomEvent('routex:override-config-updated'))
    emitDesktopEvent(IPC_ON_CHANNELS.appConfigUpdated)
    emitDesktopEvent(IPC_ON_CHANNELS.controledMihomoConfigUpdated)
    emitDesktopEvent(IPC_ON_CHANNELS.profileConfigUpdated)
    emitDesktopEvent(IPC_ON_CHANNELS.overrideConfigUpdated)
    emitDesktopEvent(IPC_ON_CHANNELS.groupsUpdated)
    emitDesktopEvent(IPC_ON_CHANNELS.rulesUpdated)
    return
  }

  return invokeSafe(C.resetAppConfig)
}

export async function createHeapSnapshot(): Promise<void> {
  await invokeSafe<string>(C.createHeapSnapshot)
}

export async function setNativeTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  return invokeSafe(C.setNativeTheme, theme)
}

export async function openUWPTool(): Promise<void> {
  return invokeSafe(C.openUWPTool)
}

export async function getUserAgent(): Promise<string> {
  return invokeSafe(C.getUserAgent)
}

export async function registerShortcut(
  oldShortcut: string,
  newShortcut: string,
  action: string
): Promise<boolean> {
  return invokeSafe(C.registerShortcut, oldShortcut, newShortcut, action)
}

export async function copyEnv(type: 'bash' | 'cmd' | 'powershell' | 'nushell'): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.copyEnv, type)
  }

  return invokeSafe(C.copyEnv, type)
}
