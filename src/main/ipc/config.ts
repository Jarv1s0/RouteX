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
  setActiveProfiles,
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
  canRollbackOverride,
  getOverride,
  rollbackOverride,
  setOverride,
  updateOverrideItem,
  getChainsConfig,
  addChainItem,
  updateChainItem,
  removeChainItem,
  removeOverrideReference,
  getAllChains,
  convertMrsRuleset,
  getQuickRulesConfig,
  setQuickRulesConfig,
  getQuickRules,
  addQuickRule,
  updateQuickRule,
  removeQuickRule,
  setQuickRulesEnabled,
  reorderQuickRules,
  clearQuickRules
} from '../config'
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../sys/autoRun'
import { restartCore } from '../core/manager'
import { refreshSSIDCheck } from '../sys/ssid'
import { mainWindow } from '..'
import { ipcErrorWrapper, registerIpcInvokeHandlers } from '../utils/ipc'
import { IPC_INVOKE_CHANNELS } from '../../shared/ipc'

// 配置文件与情景模式相关 IPC 处理器
export function registerConfigHandlers(): void {
  const C = IPC_INVOKE_CHANNELS

  registerIpcInvokeHandlers({
    [C.checkAutoRun]: ipcErrorWrapper(checkAutoRun),
    [C.enableAutoRun]: ipcErrorWrapper(enableAutoRun),
    [C.disableAutoRun]: ipcErrorWrapper(disableAutoRun),
    [C.getAppConfig]: (_e, force) => ipcErrorWrapper(getAppConfig)(force),
    [C.patchAppConfig]: (_e, config) =>
      ipcErrorWrapper(async (patch: Partial<AppConfig>) => {
        await patchAppConfig(patch)
        await refreshSSIDCheck()
      })(config),
    [C.getControledMihomoConfig]: (_e, force) => ipcErrorWrapper(getControledMihomoConfig)(force),
    [C.patchControledMihomoConfig]: (_e, config) =>
      ipcErrorWrapper(patchControledMihomoConfig)(config),
    [C.getProfileConfig]: (_e, force) => ipcErrorWrapper(getProfileConfig)(force),
    [C.setProfileConfig]: (_e, config) => ipcErrorWrapper(setProfileConfig)(config),
    [C.getCurrentProfileItem]: ipcErrorWrapper(getCurrentProfileItem),
    [C.getProfileItem]: (_e, id) => ipcErrorWrapper(getProfileItem)(id),
    [C.getProfileStr]: (_e, id) => ipcErrorWrapper(getProfileStr)(id),
    [C.getFileStr]: (_e, path) => ipcErrorWrapper(getFileStr)(path),
    [C.setFileStr]: (_e, path, str) => ipcErrorWrapper(setFileStr)(path, str),
    [C.convertMrsRuleset]: (_e, path, behavior) => ipcErrorWrapper(convertMrsRuleset)(path, behavior),
    [C.setProfileStr]: (_e, id, str) => ipcErrorWrapper(setProfileStr)(id, str),
    [C.updateProfileItem]: (_e, item) =>
      ipcErrorWrapper(async (item: ProfileItem) => {
        await updateProfileItem(item)
        mainWindow?.webContents.send('profileConfigUpdated')
      })(item),
    [C.changeCurrentProfile]: (_e, id) => ipcErrorWrapper(changeCurrentProfile)(id),
    [C.setActiveProfiles]: (_e, ids, current) =>
      ipcErrorWrapper(async (ids: string[], current?: string) => {
        await setActiveProfiles(ids, current)
        mainWindow?.webContents.send('profileConfigUpdated')
      })(ids, current),
    [C.addProfileItem]: (_e, item) =>
      ipcErrorWrapper(async (item: Partial<ProfileItem>) => {
        await addProfileItem(item)
        mainWindow?.webContents.send('profileConfigUpdated')
      })(item),
    [C.removeProfileItem]: (_e, id) =>
      ipcErrorWrapper(async (id: string) => {
        await removeProfileItem(id)
        mainWindow?.webContents.send('profileConfigUpdated')
      })(id),
    [C.getOverrideConfig]: (_e, force) => ipcErrorWrapper(getOverrideConfig)(force),
    [C.setOverrideConfig]: (_e, config) =>
      ipcErrorWrapper(async (config: OverrideConfig) => {
        await setOverrideConfig(config)
        mainWindow?.webContents.send('overrideConfigUpdated')
      })(config),
    [C.getOverrideItem]: (_e, id) => ipcErrorWrapper(getOverrideItem)(id),
    [C.canRollbackOverride]: (_e, id, ext) => ipcErrorWrapper(canRollbackOverride)(id, ext),
    [C.addOverrideItem]: (_e, item) =>
      ipcErrorWrapper(async (item: Partial<OverrideItem>) => {
        await addOverrideItem(item)
        mainWindow?.webContents.send('overrideConfigUpdated')
      })(item),
    [C.removeOverrideItem]: (_e, id) =>
      ipcErrorWrapper(async (id: string) => {
        await removeOverrideItem(id)
        await removeOverrideReference(id)
        await restartCore()
        mainWindow?.webContents.send('overrideConfigUpdated')
      })(id),
    [C.updateOverrideItem]: (_e, item) =>
      ipcErrorWrapper(async (item: OverrideItem) => {
        await updateOverrideItem(item)
        mainWindow?.webContents.send('overrideConfigUpdated')
      })(item),
    [C.getOverride]: (_e, id, ext) => ipcErrorWrapper(getOverride)(id, ext),
    [C.rollbackOverride]: (_e, id, ext) =>
      ipcErrorWrapper(async (id: string, ext: 'js' | 'yaml') => {
        await rollbackOverride(id, ext)
        await restartCore()
        mainWindow?.webContents.send('overrideConfigUpdated')
      })(id, ext),
    [C.setOverride]: (_e, id, ext, str) => ipcErrorWrapper(setOverride)(id, ext, str),
    [C.getQuickRulesConfig]: (_e, force) => ipcErrorWrapper(getQuickRulesConfig)(force),
    [C.setQuickRulesConfig]: (_e, config) =>
      ipcErrorWrapper(async (config: QuickRulesConfig) => {
        await setQuickRulesConfig(config)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
      })(config),
    [C.getQuickRules]: (_e, profileId) => ipcErrorWrapper(getQuickRules)(profileId),
    [C.addQuickRule]: (_e, profileId, rule) =>
      ipcErrorWrapper(async (profileId: string, rule: QuickRuleInput) => {
        const createdRule = await addQuickRule(profileId, rule)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
        return createdRule
      })(profileId, rule),
    [C.updateQuickRule]: (_e, profileId, ruleId, patch) =>
      ipcErrorWrapper(async (profileId: string, ruleId: string, patch: Partial<QuickRule>) => {
        await updateQuickRule(profileId, ruleId, patch)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
      })(profileId, ruleId, patch),
    [C.removeQuickRule]: (_e, profileId, ruleId) =>
      ipcErrorWrapper(async (profileId: string, ruleId: string) => {
        await removeQuickRule(profileId, ruleId)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
      })(profileId, ruleId),
    [C.setQuickRulesEnabled]: (_e, profileId, enabled) =>
      ipcErrorWrapper(async (profileId: string, enabled: boolean) => {
        await setQuickRulesEnabled(profileId, enabled)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
      })(profileId, enabled),
    [C.reorderQuickRules]: (_e, profileId, ruleIds) =>
      ipcErrorWrapper(async (profileId: string, ruleIds: string[]) => {
        await reorderQuickRules(profileId, ruleIds)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
      })(profileId, ruleIds),
    [C.clearQuickRules]: (_e, profileId) =>
      ipcErrorWrapper(async (profileId: string) => {
        await clearQuickRules(profileId)
        await restartCore()
        mainWindow?.webContents.send('quickRulesConfigUpdated')
      })(profileId),
    [C.getChainsConfig]: (_e, force) => ipcErrorWrapper(getChainsConfig)(force),
    [C.getAllChains]: ipcErrorWrapper(getAllChains),
    [C.addChainItem]: (_e, item) => ipcErrorWrapper(addChainItem)(item),
    [C.updateChainItem]: (_e, item) => ipcErrorWrapper(updateChainItem)(item),
    [C.removeChainItem]: (_e, id) => ipcErrorWrapper(removeChainItem)(id)
  })
}
