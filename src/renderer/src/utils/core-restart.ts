import { getAppConfig } from '@renderer/api/app'
import { isExpectedMihomoUnavailableError, reloadCoreConfig, restartCore } from './mihomo-ipc'
import { notifyError } from './notify'
import { createQueuedAsyncRunner } from './queued-async-runner'
import { translate } from '@renderer/i18n'

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
