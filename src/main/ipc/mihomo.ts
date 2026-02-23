import { ipcMain } from 'electron'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoCloseConnection,
  mihomoGroupDelay,
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
import { ipcErrorWrapper } from '../utils/ipc'

// Mihomo 内核相关 IPC 处理器
export function registerMihomoHandlers(): void {
  ipcMain.handle('mihomoVersion', ipcErrorWrapper(mihomoVersion))
  ipcMain.handle('mihomoConfig', ipcErrorWrapper(mihomoConfig))
  ipcMain.handle('mihomoCloseConnection', (_e, id) => ipcErrorWrapper(mihomoCloseConnection)(id))
  ipcMain.handle('mihomoCloseAllConnections', (_e, name) =>
    ipcErrorWrapper(mihomoCloseAllConnections)(name)
  )
  ipcMain.handle('mihomoRules', ipcErrorWrapper(mihomoRules))
  ipcMain.handle('mihomoToggleRuleDisabled', (_e, data) =>
    ipcErrorWrapper(mihomoToggleRuleDisabled)(data)
  )
  ipcMain.handle('mihomoProxies', ipcErrorWrapper(mihomoProxies))
  ipcMain.handle('mihomoGroups', ipcErrorWrapper(mihomoGroups))
  ipcMain.handle('mihomoProxyProviders', ipcErrorWrapper(mihomoProxyProviders))
  ipcMain.handle('mihomoUpdateProxyProviders', (_e, name) =>
    ipcErrorWrapper(mihomoUpdateProxyProviders)(name)
  )
  ipcMain.handle('mihomoRuleProviders', ipcErrorWrapper(mihomoRuleProviders))
  ipcMain.handle('mihomoUpdateRuleProviders', (_e, name) =>
    ipcErrorWrapper(mihomoUpdateRuleProviders)(name)
  )
  ipcMain.handle('mihomoChangeProxy', (_e, group, proxy) =>
    ipcErrorWrapper(mihomoChangeProxy)(group, proxy)
  )
  ipcMain.handle('mihomoUnfixedProxy', (_e, group) => ipcErrorWrapper(mihomoUnfixedProxy)(group))
  ipcMain.handle('mihomoUpgradeGeo', ipcErrorWrapper(mihomoUpgradeGeo))
  ipcMain.handle('mihomoUpgradeUI', ipcErrorWrapper(mihomoUpgradeUI))
  ipcMain.handle('mihomoDnsQuery', (_e, name, type) => ipcErrorWrapper(mihomoDnsQuery)(name, type))
  ipcMain.handle('mihomoUpgrade', ipcErrorWrapper(upgradeMihomo))
  ipcMain.handle('checkMihomoLatestVersion', (_e, isAlpha) => ipcErrorWrapper(checkMihomoLatestVersion)(isAlpha))
  ipcMain.handle('mihomoProxyDelay', (_e, proxy, url) =>
    ipcErrorWrapper(mihomoProxyDelay)(proxy, url)
  )
  ipcMain.handle('mihomoGroupDelay', (_e, group, url) =>
    ipcErrorWrapper(mihomoGroupDelay)(group, url)
  )
  ipcMain.handle('patchMihomoConfig', (_e, patch) => ipcErrorWrapper(patchMihomoConfig)(patch))
  ipcMain.handle('restartMihomoConnections', ipcErrorWrapper(restartMihomoConnections))
}
