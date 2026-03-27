import {
  manualGrantCorePermition,
  quitWithoutCore,
  restartCore,
  startNetworkDetection,
  stopNetworkDetection,
  revokeCorePermission,
  checkCorePermission
} from '../../core/manager'
import { triggerSysProxy } from '../../sys/sysproxy'
import {
  checkElevateTask,
  deleteElevateTask,
  openUWPTool,
  setupFirewall
} from '../../sys/misc'
import {
  serviceStatus,
  installService,
  uninstallService,
  startService,
  stopService,
  initService,
  testServiceConnection,
  restartService
} from '../../service/manager'
import { findSystemMihomo } from '../../utils/dirs'
import { getInterfaces } from '../../sys/interface'
import { startMonitor } from '../../resolve/trafficMonitor'
import { ipcErrorWrapper, type IpcInvokeHandlerMap } from '../../utils/ipc'
import { IPC_INVOKE_CHANNELS } from '../../../shared/ipc'

export function createRuntimeHandlers(): IpcInvokeHandlerMap {
  const C = IPC_INVOKE_CHANNELS

  return {
    [C.restartCore]: ipcErrorWrapper(restartCore),
    [C.startMonitor]: (_e, detached) => ipcErrorWrapper(startMonitor)(detached),
    [C.triggerSysProxy]: (_e, enable, onlyActiveDevice) =>
      ipcErrorWrapper(triggerSysProxy)(enable, onlyActiveDevice),
    [C.manualGrantCorePermition]: (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
      ipcErrorWrapper(manualGrantCorePermition)(cores),
    [C.checkCorePermission]: () => ipcErrorWrapper(checkCorePermission)(),
    [C.revokeCorePermission]: (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
      ipcErrorWrapper(revokeCorePermission)(cores),
    [C.checkElevateTask]: () => ipcErrorWrapper(checkElevateTask)(),
    [C.deleteElevateTask]: () => ipcErrorWrapper(deleteElevateTask)(),
    [C.serviceStatus]: () => ipcErrorWrapper(serviceStatus)(),
    [C.testServiceConnection]: () => ipcErrorWrapper(testServiceConnection)(),
    [C.initService]: () => ipcErrorWrapper(initService)(),
    [C.installService]: () => ipcErrorWrapper(installService)(),
    [C.uninstallService]: () => ipcErrorWrapper(uninstallService)(),
    [C.startService]: () => ipcErrorWrapper(startService)(),
    [C.restartService]: () => ipcErrorWrapper(restartService)(),
    [C.stopService]: () => ipcErrorWrapper(stopService)(),
    [C.findSystemMihomo]: () => findSystemMihomo(),
    [C.openUWPTool]: ipcErrorWrapper(openUWPTool),
    [C.setupFirewall]: ipcErrorWrapper(setupFirewall),
    [C.getInterfaces]: getInterfaces,
    [C.quitWithoutCore]: ipcErrorWrapper(quitWithoutCore),
    [C.startNetworkDetection]: ipcErrorWrapper(startNetworkDetection),
    [C.stopNetworkDetection]: ipcErrorWrapper(stopNetworkDetection)
  }
}
