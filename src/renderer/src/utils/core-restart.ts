import { getAppConfig } from '@renderer/api/app'
import { reloadCoreConfig, restartCore } from './mihomo-ipc'
import { notifyError } from './notify'
import { createQueuedAsyncRunner } from './queued-async-runner'
import { translate } from '@renderer/i18n'

async function applyCoreConfigChange(): Promise<void> {
  const shouldHotReload = (await getAppConfig().catch(() => undefined))?.hotReloadCoreOnSave ?? true
  if (!shouldHotReload) {
    await restartCore()
  } else {
    await reloadCoreConfig(true)
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
