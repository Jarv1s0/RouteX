import { getAppConfig } from '@renderer/api/app'
import { reloadCoreConfig, restartCore } from './mihomo-ipc'
import { notifyError } from './notify'
import { createQueuedAsyncRunner } from './queued-async-runner'

async function applyCoreConfigChange(): Promise<void> {
  const shouldHotReload = (await getAppConfig().catch(() => undefined))?.hotReloadCoreOnSave ?? true
  if (!shouldHotReload) {
    await restartCore()
  } else {
    await reloadCoreConfig(true)
  }
}

export function restartCoreInBackground(errorTitle = '应用配置失败'): void {
  void applyCoreConfigChange().catch((error) => {
    notifyError(error, { title: errorTitle })
  })
}

export function createQueuedCoreRestartRunner(errorTitle = '应用配置失败'): () => void {
  return createQueuedAsyncRunner(applyCoreConfigChange, (error) => {
    notifyError(error, { title: errorTitle })
  })
}
