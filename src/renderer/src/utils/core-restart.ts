import { getAppConfig } from '@renderer/api/app'
import { isExpectedMihomoUnavailableError, reloadCoreConfig, restartCore } from './mihomo-ipc'
import { notifyError } from './notify'
import { createQueuedAsyncRunner } from './queued-async-runner'
import { translate } from '@renderer/i18n'
import { mutate } from 'swr'
import { C, invokeSafe } from './ipc-core'
import { getControledMihomoConfig, syncAppliedCoreConfig } from './mihomo-ipc'
import { useAppStore } from '@renderer/store/use-app-store'

type ConfigPatch<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: ConfigPatch<T[K]> | null }
    : T

export interface ConfigChange {
  app?: Partial<AppConfig>
  core?: ConfigPatch<MihomoConfig>
  restart?: boolean
}

// Persist, validate and apply under one backend lock. Reconcile from disk even
// after failure, since the backend may have restored an earlier configuration.
export async function applyConfigChange(change: ConfigChange): Promise<void> {
  try {
    const result = await invokeSafe<{ controller?: string }>(C.applyConfig, change)
    syncAppliedCoreConfig(result)
  } finally {
    await Promise.allSettled([
      getAppConfig(true).then((config) => useAppStore.getState().setAppConfig(config)),
      mutate('getControledMihomoConfig', getControledMihomoConfig(true), { revalidate: false })
    ])
  }
}

function shouldFallbackToRestart(error: unknown): boolean {
  const message = String(error ?? '')
  return (
    isExpectedMihomoUnavailableError(error) ||
    message.includes('Mihomo core is not running') ||
    message.includes('Mihomo config path is not available') ||
    message.includes('Mihomo work dir is not available')
  )
}

async function applyCoreConfigChange(): Promise<void> {
  const shouldHotReload = (await getAppConfig().catch(() => undefined))?.hotReloadCoreOnSave ?? true
  if (!shouldHotReload) {
    await restartCore()
  } else {
    try {
      await reloadCoreConfig(true)
    } catch (error) {
      if (!shouldFallbackToRestart(error)) {
        throw error
      }
      await restartCore()
    }
  }
}

export function restartCoreInBackground(errorTitle = translate('common.applyConfigFailed')): void {
  void applyCoreConfigChange().catch((error) => {
    notifyError(error, { title: errorTitle })
  })
}

export function createQueuedCoreRestartRunner(
  errorTitle = translate('common.applyConfigFailed')
): () => void {
  return createQueuedAsyncRunner(applyCoreConfigChange, (error) => {
    notifyError(error, { title: errorTitle })
  })
}
