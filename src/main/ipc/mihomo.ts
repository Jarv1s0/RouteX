import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoGroupDelay,
  mihomoGetConnections,
  mihomoGroups,
  mihomoProxies,
  mihomoProxyDelay,
  mihomoProxyProviders,
  mihomoRuleProviders,
  mihomoRules,
  mihomoToggleRuleDisabled,
  mihomoUnfixedProxy,
  mihomoUpdateProxyProviders,
  mihomoUpdateRuleProviders,
  mihomoUpgradeUI,
  mihomoDnsQuery,
  mihomoUpgradeGeo,
  mihomoVersion,
  mihomoConfig,
  patchMihomoConfig,
  restartMihomoConnections,
  checkMihomoLatestVersion
} from '../core/mihomoApi'
import { upgradeMihomo } from '../core/updater'
import { ipcErrorWrapper, registerIpcInvokeHandlers } from '../utils/ipc'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'
import { ensureMihomoCoreAvailable } from '../utils/runtimeAssets'

// Mihomo 内核相关 IPC 处理器
export function registerMihomoHandlers(): void {
  const C = IPC_INVOKE_CHANNELS

  registerIpcInvokeHandlers({
    [C.ensureMihomoCoreAvailable]: (_e, core) => ipcErrorWrapper(ensureMihomoCoreAvailable)(core),
    [C.mihomoVersion]: ipcErrorWrapper(mihomoVersion),
    [C.mihomoConfig]: ipcErrorWrapper(mihomoConfig),
    [C.mihomoConnections]: ipcErrorWrapper(mihomoGetConnections),
    [C.mihomoCloseConnection]: (_e, id) => ipcErrorWrapper(mihomoCloseConnection)(id),
    [C.mihomoCloseAllConnections]: (_e, name) => ipcErrorWrapper(mihomoCloseAllConnections)(name),
    [C.mihomoRules]: ipcErrorWrapper(mihomoRules),
    [C.mihomoToggleRuleDisabled]: (_e, data) => ipcErrorWrapper(mihomoToggleRuleDisabled)(data),
    [C.mihomoProxies]: ipcErrorWrapper(mihomoProxies),
    [C.mihomoGroups]: ipcErrorWrapper(mihomoGroups),
    [C.mihomoProxyProviders]: ipcErrorWrapper(mihomoProxyProviders),
    [C.mihomoUpdateProxyProviders]: (_e, name) => ipcErrorWrapper(mihomoUpdateProxyProviders)(name),
    [C.mihomoRuleProviders]: ipcErrorWrapper(mihomoRuleProviders),
    [C.mihomoUpdateRuleProviders]: (_e, name) => ipcErrorWrapper(mihomoUpdateRuleProviders)(name),
    [C.mihomoChangeProxy]: (_e, group, proxy) => ipcErrorWrapper(mihomoChangeProxy)(group, proxy),
    [C.mihomoUnfixedProxy]: (_e, group) => ipcErrorWrapper(mihomoUnfixedProxy)(group),
    [C.mihomoUpgradeGeo]: ipcErrorWrapper(mihomoUpgradeGeo),
    [C.mihomoUpgradeUI]: ipcErrorWrapper(mihomoUpgradeUI),
    [C.mihomoDnsQuery]: (_e, name, type) => ipcErrorWrapper(mihomoDnsQuery)(name, type),
    [C.mihomoUpgrade]: ipcErrorWrapper(upgradeMihomo),
    [C.checkMihomoLatestVersion]: (_e, isAlpha) => ipcErrorWrapper(checkMihomoLatestVersion)(isAlpha),
    [C.mihomoProxyDelay]: (_e, proxy, url) => ipcErrorWrapper(mihomoProxyDelay)(proxy, url),
    [C.mihomoGroupDelay]: (_e, group, url) => ipcErrorWrapper(mihomoGroupDelay)(group, url),
    [C.patchMihomoConfig]: (_e, patch) => ipcErrorWrapper(patchMihomoConfig)(patch),
    [C.restartMihomoConnections]: ipcErrorWrapper(restartMihomoConnections)
  })
}
