import { listWebdavBackups, webdavBackup, webdavDelete, webdavRestore } from '../../resolve/backup'
import {
  ensureSubStoreBackendServer,
  ensureSubStoreFrontendServer,
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore,
  subStoreFrontendPort,
  subStorePort
} from '../../resolve/server'
import { subStoreCollections, subStoreSubs } from '../../core/subStoreApi'
import { getTrafficStats, clearTrafficStats, getProcessTrafficRanking } from '../../resolve/trafficStats'
import { getProviderStats, clearProviderStats } from '../../resolve/providerStats'
import {
  startNetworkHealthMonitor,
  stopNetworkHealthMonitor,
  getNetworkHealthStats
} from '../../resolve/networkHealth'
import { ipcErrorWrapper, type IpcInvokeHandlerMap } from '../../utils/ipc'
import { IPC_INVOKE_CHANNELS } from '../../../shared/ipc'

export function createDataHandlers(): IpcInvokeHandlerMap {
  const C = IPC_INVOKE_CHANNELS

  return {
    [C.webdavBackup]: () => ipcErrorWrapper(webdavBackup)(),
    [C.webdavRestore]: (_e, filename) => ipcErrorWrapper(webdavRestore)(filename),
    [C.listWebdavBackups]: ipcErrorWrapper(listWebdavBackups),
    [C.webdavDelete]: (_e, filename) => ipcErrorWrapper(webdavDelete)(filename),
    [C.startSubStoreFrontendServer]: () => ipcErrorWrapper(startSubStoreFrontendServer)(),
    [C.stopSubStoreFrontendServer]: () => ipcErrorWrapper(stopSubStoreFrontendServer)(),
    [C.startSubStoreBackendServer]: () => ipcErrorWrapper(startSubStoreBackendServer)(),
    [C.stopSubStoreBackendServer]: () => ipcErrorWrapper(stopSubStoreBackendServer)(),
    [C.downloadSubStore]: () => ipcErrorWrapper(downloadSubStore)(),
    [C.subStorePort]: async () => {
      await ensureSubStoreBackendServer()
      return subStorePort
    },
    [C.subStoreFrontendPort]: async () => {
      await ensureSubStoreFrontendServer()
      return subStoreFrontendPort
    },
    [C.subStoreSubs]: () => ipcErrorWrapper(subStoreSubs)(),
    [C.subStoreCollections]: () => ipcErrorWrapper(subStoreCollections)(),
    [C.getTrafficStats]: () => getTrafficStats(),
    [C.clearTrafficStats]: () => clearTrafficStats(),
    [C.getProcessTrafficRanking]: (_e, type: 'session' | 'today', sortBy: 'upload' | 'download') =>
      getProcessTrafficRanking(type, sortBy),
    [C.getProviderStats]: () => getProviderStats(),
    [C.clearProviderStats]: () => clearProviderStats(),
    [C.startNetworkHealthMonitor]: () => {
      startNetworkHealthMonitor()
    },
    [C.stopNetworkHealthMonitor]: () => {
      stopNetworkHealthMonitor()
    },
    [C.getNetworkHealthStats]: () => getNetworkHealthStats(),
    [C.getAppUptime]: () => process.uptime(),
    [C.getAppMemory]: async () => {
      const metrics = await process.getProcessMemoryInfo()
      return metrics.private
    }
  }
}
