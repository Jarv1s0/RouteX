import { restartCore } from './mihomo-ipc'
import { notifyError } from './notify'
import { createQueuedAsyncRunner } from './queued-async-runner'

export function restartCoreInBackground(errorTitle = '应用配置失败'): void {
  void restartCore().catch((error) => {
    notifyError(error, { title: errorTitle })
  })
}

export function createQueuedCoreRestartRunner(errorTitle = '应用配置失败'): () => void {
  return createQueuedAsyncRunner(restartCore, (error) => {
    notifyError(error, { title: errorTitle })
  })
}
