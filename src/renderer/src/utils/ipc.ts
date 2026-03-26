import { TitleBarOverlayOptions } from 'electron'
import { notifyError } from './notify'
import { IPC_INVOKE_CHANNELS, type IpcInvokeChannel } from '../../../shared/ipc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ipcErrorWrapper(response: any): any {
  if (typeof response === 'object' && 'invokeError' in response) {
    throw response.invokeError
  } else {
    return response
  }
}

const C = IPC_INVOKE_CHANNELS

async function invokeSafe<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T> {
  return ipcErrorWrapper(await window.electron.ipcRenderer.invoke<T>(channel, ...args))
}

async function invokeRaw<T>(channel: IpcInvokeChannel, ...args: unknown[]): Promise<T> {
  return window.electron.ipcRenderer.invoke<T>(channel, ...args)
}

export async function mihomoVersion(): Promise<ControllerVersion> {
  return invokeSafe(C.mihomoVersion)
}

export async function mihomoConfig(): Promise<ControllerConfigs> {
  return invokeSafe(C.mihomoConfig)
}

export async function mihomoCloseConnection(id: string): Promise<void> {
  return invokeSafe(C.mihomoCloseConnection, id)
}

export async function mihomoCloseAllConnections(name?: string): Promise<void> {
  return invokeSafe(C.mihomoCloseAllConnections, name)
}

export async function mihomoRules(): Promise<ControllerRules> {
  return invokeSafe(C.mihomoRules)
}

export async function mihomoToggleRuleDisabled(data: Record<number, boolean>): Promise<void> {
  return invokeSafe(C.mihomoToggleRuleDisabled, data)
}

export async function mihomoProxies(): Promise<ControllerProxies> {
  return invokeSafe(C.mihomoProxies)
}

export async function mihomoGroups(): Promise<ControllerMixedGroup[]> {
  return invokeSafe(C.mihomoGroups)
}

export async function mihomoProxyProviders(): Promise<ControllerProxyProviders> {
  return invokeSafe(C.mihomoProxyProviders)
}

export async function mihomoUpdateProxyProviders(name: string): Promise<void> {
  return invokeSafe(C.mihomoUpdateProxyProviders, name)
}

export async function mihomoRuleProviders(): Promise<ControllerRuleProviders> {
  return invokeSafe(C.mihomoRuleProviders)
}

export async function mihomoUpdateRuleProviders(name: string): Promise<void> {
  return invokeSafe(C.mihomoUpdateRuleProviders, name)
}

export async function mihomoChangeProxy(
  group: string,
  proxy: string
): Promise<ControllerProxiesDetail> {
  return invokeSafe(C.mihomoChangeProxy, group, proxy)
}

export async function mihomoUnfixedProxy(group: string): Promise<ControllerProxiesDetail> {
  return invokeSafe(C.mihomoUnfixedProxy, group)
}

export async function mihomoUpgradeGeo(): Promise<void> {
  return invokeSafe(C.mihomoUpgradeGeo)
}

export async function mihomoUpgradeUI(): Promise<void> {
  return invokeSafe(C.mihomoUpgradeUI)
}

export async function mihomoDnsQuery(name: string, type: string): Promise<{ Answer?: { data: string }[] }> {
  return invokeSafe(C.mihomoDnsQuery, name, type)
}

export async function mihomoUpgrade(): Promise<void> {
  return invokeSafe(C.mihomoUpgrade)
}

export async function checkMihomoLatestVersion(isAlpha: boolean): Promise<string | null> {
  return invokeSafe(C.checkMihomoLatestVersion, isAlpha)
}

export async function mihomoProxyDelay(
  proxy: string,
  url?: string
): Promise<ControllerProxiesDelay> {
  return invokeSafe(C.mihomoProxyDelay, proxy, url)
}

export async function mihomoGroupDelay(group: string, url?: string): Promise<ControllerGroupDelay> {
  return invokeSafe(C.mihomoGroupDelay, group, url)
}

export async function patchMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  return invokeSafe(C.patchMihomoConfig, patch)
}

export async function checkAutoRun(): Promise<boolean> {
  return invokeSafe(C.checkAutoRun)
}

export async function enableAutoRun(): Promise<void> {
  return invokeSafe(C.enableAutoRun)
}

export async function disableAutoRun(): Promise<void> {
  return invokeSafe(C.disableAutoRun)
}

export async function getAppConfig(force = false): Promise<AppConfig> {
  return invokeSafe(C.getAppConfig, force)
}

export async function patchAppConfig(patch: Partial<AppConfig>): Promise<void> {
  return invokeSafe(C.patchAppConfig, patch)
}

export async function getControledMihomoConfig(force = false): Promise<Partial<MihomoConfig>> {
  return invokeSafe(C.getControledMihomoConfig, force)
}

export async function patchControledMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  return invokeSafe(C.patchControledMihomoConfig, patch)
}

export async function getProfileConfig(force = false): Promise<ProfileConfig> {
  return invokeSafe(C.getProfileConfig, force)
}

export async function setProfileConfig(config: ProfileConfig): Promise<void> {
  return invokeSafe(C.setProfileConfig, config)
}

export async function getCurrentProfileItem(): Promise<ProfileItem> {
  return invokeSafe(C.getCurrentProfileItem)
}

export async function getProfileItem(id: string | undefined): Promise<ProfileItem> {
  return invokeSafe(C.getProfileItem, id)
}

export async function changeCurrentProfile(id: string): Promise<void> {
  return invokeSafe(C.changeCurrentProfile, id)
}

export async function addProfileItem(item: Partial<ProfileItem>): Promise<void> {
  return invokeSafe(C.addProfileItem, item)
}

export async function removeProfileItem(id: string): Promise<void> {
  return invokeSafe(C.removeProfileItem, id)
}

export async function updateProfileItem(item: ProfileItem): Promise<void> {
  return invokeSafe(C.updateProfileItem, item)
}

export async function getProfileStr(id: string): Promise<string> {
  return invokeSafe(C.getProfileStr, id)
}

export async function getFileStr(id: string): Promise<string> {
  return invokeSafe(C.getFileStr, id)
}

export async function setFileStr(id: string, str: string): Promise<void> {
  return invokeSafe(C.setFileStr, id, str)
}

export async function setProfileStr(id: string, str: string): Promise<void> {
  return invokeSafe(C.setProfileStr, id, str)
}

export async function convertMrsRuleset(path: string, behavior: string): Promise<string> {
  return invokeSafe(C.convertMrsRuleset, path, behavior)
}

export async function getOverrideConfig(force = false): Promise<OverrideConfig> {
  return invokeSafe(C.getOverrideConfig, force)
}

export async function setOverrideConfig(config: OverrideConfig): Promise<void> {
  return invokeSafe(C.setOverrideConfig, config)
}

export async function getOverrideItem(id: string): Promise<OverrideItem | undefined> {
  return invokeSafe(C.getOverrideItem, id)
}

export async function addOverrideItem(item: Partial<OverrideItem>): Promise<void> {
  return invokeSafe(C.addOverrideItem, item)
}

export async function removeOverrideItem(id: string): Promise<void> {
  return invokeSafe(C.removeOverrideItem, id)
}

export async function updateOverrideItem(item: OverrideItem): Promise<void> {
  return invokeSafe(C.updateOverrideItem, item)
}

export async function getOverride(id: string, ext: 'js' | 'yaml' | 'log'): Promise<string> {
  return invokeSafe(C.getOverride, id, ext)
}

export async function canRollbackOverride(id: string, ext: 'js' | 'yaml'): Promise<boolean> {
  return invokeSafe(C.canRollbackOverride, id, ext)
}

export async function rollbackOverride(id: string, ext: 'js' | 'yaml'): Promise<void> {
  return invokeSafe(C.rollbackOverride, id, ext)
}

export async function setOverride(id: string, ext: 'js' | 'yaml', str: string): Promise<void> {
  return invokeSafe(C.setOverride, id, ext, str)
}

// 代理链 IPC
export async function getChainsConfig(force = false): Promise<ChainsConfig> {
  return invokeSafe(C.getChainsConfig, force)
}

export async function getAllChains(): Promise<ChainItem[]> {
  return invokeSafe(C.getAllChains)
}

export async function addChainItem(item: Partial<ChainItem>): Promise<ChainItem> {
  return invokeSafe(C.addChainItem, item)
}

export async function updateChainItem(item: ChainItem): Promise<void> {
  return invokeSafe(C.updateChainItem, item)
}

export async function removeChainItem(id: string): Promise<void> {
  return invokeSafe(C.removeChainItem, id)
}

export async function restartCore(): Promise<void> {
  return invokeSafe(C.restartCore)
}

export async function restartMihomoConnections(): Promise<void> {
  return invokeSafe(C.restartMihomoConnections)
}

export async function startMonitor(): Promise<void> {
  return invokeSafe(C.startMonitor)
}

export async function triggerSysProxy(enable: boolean, onlyActiveDevice: boolean): Promise<void> {
  return invokeSafe(C.triggerSysProxy, enable, onlyActiveDevice)
}

export async function manualGrantCorePermition(
  cores?: ('mihomo' | 'mihomo-alpha')[]
): Promise<void> {
  return invokeSafe(C.manualGrantCorePermition, cores)
}

export async function checkCorePermission(): Promise<{ mihomo: boolean; 'mihomo-alpha': boolean }> {
  return invokeSafe(C.checkCorePermission)
}

export async function checkElevateTask(): Promise<boolean> {
  return invokeSafe(C.checkElevateTask)
}

export async function deleteElevateTask(): Promise<void> {
  return invokeSafe(C.deleteElevateTask)
}

export async function revokeCorePermission(cores?: ('mihomo' | 'mihomo-alpha')[]): Promise<void> {
  return invokeSafe(C.revokeCorePermission, cores)
}

export async function serviceStatus(): Promise<
  'running' | 'stopped' | 'not-installed' | 'unknown'
> {
  return invokeSafe(C.serviceStatus)
}

export async function testServiceConnection(): Promise<boolean> {
  return invokeSafe(C.testServiceConnection)
}

export async function initService(): Promise<void> {
  return invokeSafe(C.initService)
}

export async function installService(): Promise<void> {
  return invokeSafe(C.installService)
}

export async function uninstallService(): Promise<void> {
  return invokeSafe(C.uninstallService)
}

export async function startService(): Promise<void> {
  return invokeSafe(C.startService)
}

export async function restartService(): Promise<void> {
  return invokeSafe(C.restartService)
}

export async function stopService(): Promise<void> {
  return invokeSafe(C.stopService)
}

export async function findSystemMihomo(): Promise<string[]> {
  return invokeSafe(C.findSystemMihomo)
}

export async function getFilePath(ext: string[]): Promise<string[] | undefined> {
  return invokeSafe(C.getFilePath, ext)
}

export async function saveFile(content: string, defaultName: string, ext: string): Promise<boolean> {
  return invokeSafe(C.saveFile, content, defaultName, ext)
}

export async function readTextFile(filePath: string): Promise<string> {
  return invokeSafe(C.readTextFile, filePath)
}

export async function getRuntimeConfigStr(): Promise<string> {
  return invokeSafe(C.getRuntimeConfigStr)
}

export async function getRawProfileStr(): Promise<string> {
  return invokeSafe(C.getRawProfileStr)
}

export async function getCurrentProfileStr(): Promise<string> {
  return invokeSafe(C.getCurrentProfileStr)
}

export async function getOverrideProfileStr(): Promise<string> {
  return invokeSafe(C.getOverrideProfileStr)
}

export async function getRuntimeConfig(): Promise<MihomoConfig> {
  return invokeSafe(C.getRuntimeConfig)
}

export async function checkUpdate(): Promise<AppVersion | undefined> {
  return invokeSafe(C.checkUpdate)
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  return invokeSafe(C.downloadAndInstallUpdate, version)
}

export async function cancelUpdate(): Promise<void> {
  return invokeSafe(C.cancelUpdate)
}

export async function getVersion(): Promise<string> {
  return invokeSafe(C.getVersion)
}

export async function getPlatform(): Promise<NodeJS.Platform> {
  return invokeSafe(C.platform)
}

export async function openUWPTool(): Promise<void> {
  return invokeSafe(C.openUWPTool)
}

export async function setupFirewall(): Promise<void> {
  return invokeSafe(C.setupFirewall)
}

export async function getInterfaces(): Promise<Record<string, NetworkInterfaceInfo[]>> {
  return invokeSafe(C.getInterfaces)
}

export async function webdavBackup(): Promise<boolean> {
  return invokeSafe(C.webdavBackup)
}

export async function webdavRestore(filename: string): Promise<void> {
  return invokeSafe(C.webdavRestore, filename)
}

export async function listWebdavBackups(): Promise<string[]> {
  return invokeSafe(C.listWebdavBackups)
}

export async function webdavDelete(filename: string): Promise<void> {
  return invokeSafe(C.webdavDelete, filename)
}

export async function setTitleBarOverlay(overlay: TitleBarOverlayOptions): Promise<void> {
  return invokeSafe(C.setTitleBarOverlay, overlay)
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  return invokeSafe(C.setAlwaysOnTop, alwaysOnTop)
}

export async function isAlwaysOnTop(): Promise<boolean> {
  return invokeSafe(C.isAlwaysOnTop)
}

export async function relaunchApp(): Promise<void> {
  return invokeSafe(C.relaunchApp)
}

export async function quitWithoutCore(): Promise<void> {
  return invokeSafe(C.quitWithoutCore)
}

export async function quitApp(): Promise<void> {
  return invokeSafe(C.quitApp)
}

export async function notDialogQuit(): Promise<void> {
  return invokeSafe(C.notDialogQuit)
}

export async function setNativeTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
  return invokeSafe(C.setNativeTheme, theme)
}

export async function getGistUrl(): Promise<string> {
  return invokeSafe(C.getGistUrl)
}

export async function startSubStoreFrontendServer(): Promise<void> {
  return invokeSafe(C.startSubStoreFrontendServer)
}

export async function stopSubStoreFrontendServer(): Promise<void> {
  return invokeSafe(C.stopSubStoreFrontendServer)
}

export async function startSubStoreBackendServer(): Promise<void> {
  return invokeSafe(C.startSubStoreBackendServer)
}

export async function stopSubStoreBackendServer(): Promise<void> {
  return invokeSafe(C.stopSubStoreBackendServer)
}
export async function downloadSubStore(): Promise<void> {
  return invokeSafe(C.downloadSubStore)
}

export async function subStorePort(): Promise<number> {
  return invokeSafe(C.subStorePort)
}

export async function subStoreFrontendPort(): Promise<number> {
  return invokeSafe(C.subStoreFrontendPort)
}

export async function subStoreSubs(): Promise<SubStoreSub[]> {
  return invokeSafe(C.subStoreSubs)
}

export async function subStoreCollections(): Promise<SubStoreSub[]> {
  return invokeSafe(C.subStoreCollections)
}

export async function showTrayIcon(): Promise<void> {
  return invokeSafe(C.showTrayIcon)
}

export async function closeTrayIcon(): Promise<void> {
  return invokeSafe(C.closeTrayIcon)
}

export async function setDockVisible(visible: boolean): Promise<void> {
  return invokeSafe(C.setDockVisible, visible)
}

export async function showMainWindow(): Promise<void> {
  return invokeSafe(C.showMainWindow)
}

export async function closeMainWindow(): Promise<void> {
  return invokeSafe(C.closeMainWindow)
}

export async function windowMin(): Promise<void> {
  return invokeSafe(C.windowMin)
}

export async function windowMax(): Promise<void> {
  return invokeSafe(C.windowMax)
}

export async function triggerMainWindow(): Promise<void> {
  return invokeSafe(C.triggerMainWindow)
}

export async function showFloatingWindow(): Promise<void> {
  return invokeSafe(C.showFloatingWindow)
}

export async function closeFloatingWindow(): Promise<void> {
  return invokeSafe(C.closeFloatingWindow)
}

export async function showContextMenu(): Promise<void> {
  return invokeSafe(C.showContextMenu)
}

export async function openFile(
  type: 'profile' | 'override',
  id: string,
  ext?: 'yaml' | 'js'
): Promise<void> {
  return invokeSafe(C.openFile, type, id, ext)
}

export async function openDevTools(): Promise<void> {
  return invokeSafe(C.openDevTools)
}

export async function resetAppConfig(): Promise<void> {
  return invokeSafe(C.resetAppConfig)
}

export async function createHeapSnapshot(): Promise<void> {
  return invokeSafe(C.createHeapSnapshot)
}

export async function getUserAgent(): Promise<string> {
  return invokeSafe(C.getUserAgent)
}

export async function getAppName(appPath: string): Promise<string> {
  return invokeSafe(C.getAppName, appPath)
}

export async function getTrafficStats(): Promise<{
  hourly: { hour: string; upload: number; download: number }[]
  daily: { date: string; upload: number; download: number }[]
  lastUpdate: number
  sessionUpload: number
  sessionDownload: number
}> {
  return invokeRaw(C.getTrafficStats)
}

export async function clearTrafficStats(): Promise<void> {
  return invokeRaw(C.clearTrafficStats)
}

export async function getProcessTrafficRanking(type: 'session' | 'today', sortBy: 'upload' | 'download'): Promise<{
  process: string
  host: string
  upload: number
  download: number
}[]> {
  return invokeRaw(C.getProcessTrafficRanking, type, sortBy)
}

export async function getProviderStats(): Promise<{
  snapshots: { date: string; provider: string; used: number }[]
  lastUpdate: number
}> {
  return invokeRaw(C.getProviderStats)
}

export async function clearProviderStats(): Promise<void> {
  return invokeRaw(C.clearProviderStats)
}

export async function fetchIpInfo(): Promise<{
  status: string
  message?: string
  query?: string
  country?: string
  countryCode?: string
  region?: string
  regionName?: string
  city?: string
  zip?: string
  lat?: number
  lon?: number
  timezone?: string
  isp?: string
  org?: string
  as?: string
}> {
  return invokeSafe(C.fetchIpInfo)
}

interface IpInfoQuery {
  query: string
  lang?: string
}

export interface IpInfoResult {
  status: string
  message?: string
  query?: string
  country?: string
  countryCode?: string
  region?: string
  regionName?: string
  city?: string
  zip?: string
  lat?: number
  lon?: number
  timezone?: string
  isp?: string
  org?: string
  as?: string
}

export async function fetchBatchIpInfo(queries: IpInfoQuery[]): Promise<IpInfoResult[]> {
  return invokeSafe(C.fetchBatchIpInfo, queries)
}

export async function fetchIpInfoQuery(query: string): Promise<IpInfoResult> {
  return invokeSafe(C.fetchIpInfoQuery, query)
}

export async function testRuleMatch(domain: string): Promise<{ rule: string; rulePayload: string; proxy: string } | null> {
  return invokeSafe(C.testRuleMatch, domain)
}

export async function testConnectivity(url: string, timeout?: number): Promise<{ success: boolean; latency: number; status?: number; error?: string }> {
  return invokeRaw(C.testConnectivity, url, timeout)
}

export async function getImageDataURL(url: string): Promise<string> {
  return invokeSafe(C.getImageDataURL, url)
}

export async function getIconDataURL(appPath: string): Promise<string> {
  return invokeSafe(C.getIconDataURL, appPath)
}

export async function resolveThemes(): Promise<{ key: string; label: string; content: string }[]> {
  return invokeSafe(C.resolveThemes)
}

export async function fetchThemes(): Promise<void> {
  return invokeSafe(C.fetchThemes)
}

export async function importThemes(files: string[]): Promise<void> {
  return invokeSafe(C.importThemes, files)
}

export async function readTheme(theme: string): Promise<string> {
  return invokeSafe(C.readTheme, theme)
}

export async function writeTheme(theme: string, css: string): Promise<void> {
  return invokeSafe(C.writeTheme, theme, css)
}

export async function startNetworkDetection(): Promise<void> {
  return invokeSafe(C.startNetworkDetection)
}

export async function stopNetworkDetection(): Promise<void> {
  return invokeSafe(C.stopNetworkDetection)
}

let applyThemeRunning = false
const waitList: string[] = []
export async function applyTheme(theme: string): Promise<void> {
  if (applyThemeRunning) {
    waitList.push(theme)
    return
  }
  applyThemeRunning = true
  try {
    return await invokeSafe(C.applyTheme, theme)
  } finally {
    applyThemeRunning = false
    if (waitList.length > 0) {
      await applyTheme(waitList.shift() || '')
    }
  }
}

export async function registerShortcut(
  oldShortcut: string,
  newShortcut: string,
  action: string
): Promise<boolean> {
  return invokeSafe(C.registerShortcut, oldShortcut, newShortcut, action)
}

export async function copyEnv(type: 'bash' | 'cmd' | 'powershell' | 'nushell'): Promise<void> {
  return invokeSafe(C.copyEnv, type)
}

async function alert<T>(msg: T): Promise<void> {
  notifyError(msg, { title: '提示' })
}

window.alert = alert


export async function checkStreamingUnlock(service: string): Promise<{
  status: 'unlocked' | 'locked' | 'error'
  region?: string
  error?: string
}> {
  return invokeRaw(C.checkStreamingUnlock, service)
}

export async function getAppUptime(): Promise<number> {
  return invokeSafe(C.getAppUptime)
}

export async function getAppMemory(): Promise<number> {
  return invokeSafe(C.getAppMemory)
}

export async function testDNSLatency(domain: string = 'google.com'): Promise<number> {
  return invokeSafe(C.testDNSLatency, domain)
}

export async function httpGet(url: string, timeout?: number): Promise<{ status: number; data: string; headers: Record<string, string>; error?: string }> {
  return invokeRaw(C.httpGet, url, timeout)
}
