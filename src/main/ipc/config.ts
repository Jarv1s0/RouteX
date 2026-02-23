import { ipcMain } from 'electron'
import {
  getAppConfig,
  patchAppConfig,
  getControledMihomoConfig,
  patchControledMihomoConfig,
  getProfileConfig,
  getCurrentProfileItem,
  getProfileItem,
  addProfileItem,
  removeProfileItem,
  changeCurrentProfile,
  getProfileStr,
  getFileStr,
  setFileStr,
  setProfileStr,
  updateProfileItem,
  setProfileConfig,
  getOverrideConfig,
  setOverrideConfig,
  getOverrideItem,
  addOverrideItem,
  removeOverrideItem,
  getOverride,
  setOverride,
  updateOverrideItem,
  getChainsConfig,
  addChainItem,
  updateChainItem,
  removeChainItem,
  removeOverrideReference,
  getAllChains,
  convertMrsRuleset
} from '../config'
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../sys/autoRun'
import { restartCore } from '../core/manager'
import { mainWindow } from '..'
import { ipcErrorWrapper } from '../utils/ipc'

// 配置文件与情景模式相关 IPC 处理器
export function registerConfigHandlers(): void {
  ipcMain.handle('checkAutoRun', ipcErrorWrapper(checkAutoRun))
  ipcMain.handle('enableAutoRun', ipcErrorWrapper(enableAutoRun))
  ipcMain.handle('disableAutoRun', ipcErrorWrapper(disableAutoRun))
  ipcMain.handle('getAppConfig', (_e, force) => ipcErrorWrapper(getAppConfig)(force))
  ipcMain.handle('patchAppConfig', (_e, config) => ipcErrorWrapper(patchAppConfig)(config))
  ipcMain.handle('getControledMihomoConfig', (_e, force) =>
    ipcErrorWrapper(getControledMihomoConfig)(force)
  )
  ipcMain.handle('patchControledMihomoConfig', (_e, config) =>
    ipcErrorWrapper(patchControledMihomoConfig)(config)
  )
  ipcMain.handle('getProfileConfig', (_e, force) => ipcErrorWrapper(getProfileConfig)(force))
  ipcMain.handle('setProfileConfig', (_e, config) => ipcErrorWrapper(setProfileConfig)(config))
  ipcMain.handle('getCurrentProfileItem', ipcErrorWrapper(getCurrentProfileItem))
  ipcMain.handle('getProfileItem', (_e, id) => ipcErrorWrapper(getProfileItem)(id))
  ipcMain.handle('getProfileStr', (_e, id) => ipcErrorWrapper(getProfileStr)(id))
  ipcMain.handle('getFileStr', (_e, path) => ipcErrorWrapper(getFileStr)(path))
  ipcMain.handle('setFileStr', (_e, path, str) => ipcErrorWrapper(setFileStr)(path, str))
  ipcMain.handle('convertMrsRuleset', (_e, path, behavior) =>
    ipcErrorWrapper(convertMrsRuleset)(path, behavior)
  )
  ipcMain.handle('setProfileStr', (_e, id, str) => ipcErrorWrapper(setProfileStr)(id, str))
  ipcMain.handle('updateProfileItem', (_e, item) =>
    ipcErrorWrapper(async (item: ProfileItem) => {
      await updateProfileItem(item)
      mainWindow?.webContents.send('profileConfigUpdated')
    })(item)
  )
  ipcMain.handle('changeCurrentProfile', (_e, id) => ipcErrorWrapper(changeCurrentProfile)(id))
  ipcMain.handle('addProfileItem', (_e, item) =>
    ipcErrorWrapper(async (item: Partial<ProfileItem>) => {
      await addProfileItem(item)
      mainWindow?.webContents.send('profileConfigUpdated')
    })(item)
  )
  ipcMain.handle('removeProfileItem', (_e, id) =>
    ipcErrorWrapper(async (id: string) => {
      await removeProfileItem(id)
      mainWindow?.webContents.send('profileConfigUpdated')
    })(id)
  )
  ipcMain.handle('getOverrideConfig', (_e, force) => ipcErrorWrapper(getOverrideConfig)(force))
  ipcMain.handle('setOverrideConfig', (_e, config) =>
    ipcErrorWrapper(async (config: OverrideConfig) => {
      await setOverrideConfig(config)
      mainWindow?.webContents.send('overrideConfigUpdated')
    })(config)
  )
  ipcMain.handle('getOverrideItem', (_e, id) => ipcErrorWrapper(getOverrideItem)(id))
  ipcMain.handle('addOverrideItem', (_e, item) =>
    ipcErrorWrapper(async (item: Partial<OverrideItem>) => {
      await addOverrideItem(item)
      mainWindow?.webContents.send('overrideConfigUpdated')
    })(item)
  )
  ipcMain.handle('removeOverrideItem', (_e, id) =>
    ipcErrorWrapper(async (id: string) => {
      await removeOverrideItem(id)
      await removeOverrideReference(id)
      await restartCore()
      mainWindow?.webContents.send('overrideConfigUpdated')
    })(id)
  )
  ipcMain.handle('updateOverrideItem', (_e, item) =>
    ipcErrorWrapper(async (item: OverrideItem) => {
      await updateOverrideItem(item)
      mainWindow?.webContents.send('overrideConfigUpdated')
    })(item)
  )
  ipcMain.handle('getOverride', (_e, id, ext) => ipcErrorWrapper(getOverride)(id, ext))
  ipcMain.handle('setOverride', (_e, id, ext, str) => ipcErrorWrapper(setOverride)(id, ext, str))
  // 代理链
  ipcMain.handle('getChainsConfig', (_e, force) => ipcErrorWrapper(getChainsConfig)(force))
  ipcMain.handle('getAllChains', ipcErrorWrapper(getAllChains))
  ipcMain.handle('addChainItem', (_e, item) => ipcErrorWrapper(addChainItem)(item))
  ipcMain.handle('updateChainItem', (_e, item) => ipcErrorWrapper(updateChainItem)(item))
  ipcMain.handle('removeChainItem', (_e, id) => ipcErrorWrapper(removeChainItem)(id))
}
