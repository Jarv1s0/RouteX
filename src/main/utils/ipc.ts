import { app, dialog, ipcMain } from 'electron'
import { upgradeMihomo } from '../core/updater'
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
import { checkAutoRun, disableAutoRun, enableAutoRun } from '../sys/autoRun'
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

  getAllChains,
  convertMrsRuleset
} from '../config'
import {
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore,
  subStoreFrontendPort,
  subStorePort
} from '../resolve/server'
import {
  manualGrantCorePermition,
  quitWithoutCore,
  restartCore,
  startNetworkDetection,
  stopNetworkDetection,
  revokeCorePermission,
  checkCorePermission
} from '../core/manager'
import { triggerSysProxy } from '../sys/sysproxy'
import { checkUpdate, downloadAndInstallUpdate, cancelUpdate } from '../resolve/autoUpdater'
import {
  checkElevateTask,
  deleteElevateTask,
  getFilePath,
  saveFile,
  openFile,
  openUWPTool,
  readTextFile,
  resetAppConfig,
  setNativeTheme,
  setupFirewall
} from '../sys/misc'
import {
  serviceStatus,
  installService,
  uninstallService,
  startService,
  stopService,
  initService,
  testServiceConnection,
  restartService
} from '../service/manager'
import { findSystemMihomo } from '../utils/dirs'
import {
  getRuntimeConfig,
  getRuntimeConfigStr,
  getRawProfileStr,
  getCurrentProfileStr,
  getOverrideProfileStr
} from '../core/factory'
import { listWebdavBackups, webdavBackup, webdavDelete, webdavRestore } from '../resolve/backup'
import { getInterfaces } from '../sys/interface'
import { closeTrayIcon, copyEnv, setDockVisible, showTrayIcon } from '../resolve/tray'
import { registerShortcut } from '../resolve/shortcut'
import {
  closeMainWindow,
  mainWindow,
  setNotQuitDialog,
  showMainWindow,
  triggerMainWindow
} from '..'
import {
  applyTheme,
  fetchThemes,
  importThemes,
  readTheme,
  resolveThemes,
  writeTheme
} from '../resolve/theme'
import { subStoreCollections, subStoreSubs } from '../core/subStoreApi'
import { logDir } from './dirs'
import path from 'path'
import v8 from 'v8'
import { getGistUrl } from '../resolve/gistApi'
import { getIconDataURL, getImageDataURL } from './icon'
import { startMonitor } from '../resolve/trafficMonitor'
import { closeFloatingWindow, showContextMenu, showFloatingWindow } from '../resolve/floatingWindow'
import { getAppName } from './appName'
import { getUserAgent } from './userAgent'
import { getTrafficStats, clearTrafficStats, getProcessTrafficRanking } from '../resolve/trafficStats'
import { getProviderStats, clearProviderStats, triggerSnapshot } from '../resolve/providerStats'
import { net } from 'electron'
import { mihomoGetConnections } from '../core/mihomoApi'
import { startNetworkHealthMonitor, stopNetworkHealthMonitor, getNetworkHealthStats } from '../resolve/networkHealth'

// 流媒体解锁检测
interface StreamingResult {
  status: 'unlocked' | 'locked' | 'error'
  region?: string
  error?: string
}

async function checkStreamingService(service: string): Promise<StreamingResult> {
  const timeout = 15000
  
  try {
    switch (service) {
      case 'netflix':
        return await checkNetflix(timeout)
      case 'disney':
        return await checkDisney(timeout)
      case 'youtube':
        return await checkYouTube(timeout)
      case 'spotify':
        return await checkSpotify(timeout)
      case 'chatgpt':
        return await checkChatGPT(timeout)
      case 'gemini':
        return await checkGemini(timeout)
      case 'tiktok':
        return await checkTikTok(timeout)
      default:
        return { status: 'error', error: '未知服务' }
    }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function httpGet(url: string, timeout: number): Promise<{ status: number; data: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    try {
      const request = net.request({ url, method: 'GET', redirect: 'follow' })
      let data = ''
      let resolved = false
      
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          try { request.abort() } catch { /* ignore */ }
          reject(new Error('请求超时'))
        }
      }, timeout)
      
      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      request.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
      request.setHeader('Accept-Language', 'en-US,en;q=0.5')
      
      request.on('response', (response) => {
        const headers: Record<string, string> = {}
        Object.entries(response.headers).forEach(([key, value]) => {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value || ''
        })
        
        response.on('data', (chunk) => {
          data += chunk.toString()
          // 限制数据大小，避免内存问题
          if (data.length > 100000) {
            data = data.substring(0, 100000)
          }
        })
        response.on('end', () => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            resolve({ status: response.statusCode, data, headers })
          }
        })
        response.on('error', (error) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timer)
            reject(error)
          }
        })
      })
      
      request.on('error', (error) => {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          reject(error)
        }
      })
      
      request.end()
    } catch (e) {
      reject(e)
    }
  })
}

async function checkNetflix(timeout: number): Promise<StreamingResult> {
  try {
    // 检测 Netflix 非自制剧（80018499 是地区限制内容）
    const res = await httpGet('https://www.netflix.com/title/80018499', timeout)
    if (res.status === 200) {
      // 尝试从响应中提取地区
      const regionMatch = res.data.match(/"countryCode":"([A-Z]{2})"/)
      return { status: 'unlocked', region: regionMatch ? regionMatch[1] : 'Unknown' }
    } else if (res.status === 404) {
      // 404 可能是自制剧解锁
      const res2 = await httpGet('https://www.netflix.com/title/70143836', timeout)
      if (res2.status === 200) {
        return { status: 'unlocked', region: '仅自制剧' }
      }
      return { status: 'locked' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkDisney(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.disneyplus.com/', timeout)
    if (res.status === 200) {
      // 检查是否被重定向到不支持的地区页面
      if (res.data.includes('unavailable') || res.data.includes('not-available')) {
        return { status: 'locked' }
      }
      // 尝试提取地区
      const regionMatch = res.data.match(/"region":"([A-Z]{2})"/) || res.data.match(/data-location="([A-Z]{2})"/)
      return { status: 'unlocked', region: regionMatch ? regionMatch[1] : 'Unknown' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkYouTube(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.youtube.com/premium', timeout)
    if (res.status === 200) {
      // 从页面提取地区代码
      const regionMatch = res.data.match(/"GL":"([A-Z]{2})"/) || res.data.match(/"INNERTUBE_CONTEXT_GL":"([A-Z]{2})"/)
      return { status: 'unlocked', region: regionMatch ? regionMatch[1] : 'Unknown' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkSpotify(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://open.spotify.com/', timeout)
    if (res.status === 200) {
      return { status: 'unlocked', region: 'Available' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkChatGPT(timeout: number): Promise<StreamingResult> {
  try {
    // 使用 iOS 客户端 API 检测，更准确
    const res = await httpGet('https://ios.chat.openai.com/', timeout)
    if (res.status === 200 || res.status === 302 || res.status === 301) {
      return { status: 'unlocked', region: 'Available' }
    } else if (res.status === 403) {
      // 检查是否是地区限制
      if (res.data.includes('blocked') || res.data.includes('unavailable') || res.data.includes('VPN')) {
        return { status: 'locked' }
      }
    }
    // 备用检测
    const res2 = await httpGet('https://api.openai.com/v1/models', timeout)
    if (res2.status === 401) {
      // 401 表示需要认证，说明可以访问
      return { status: 'unlocked', region: 'Available' }
    } else if (res2.status === 403) {
      return { status: 'locked' }
    }
    return { status: 'unlocked', region: 'Available' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkTikTok(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://www.tiktok.com/', timeout)
    if (res.status === 200) {
      // 检查是否被重定向或阻止
      if (res.data.includes('not available') || res.data.includes('unavailable')) {
        return { status: 'locked' }
      }
      return { status: 'unlocked', region: 'Available' }
    }
    return { status: 'locked' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

async function checkGemini(timeout: number): Promise<StreamingResult> {
  try {
    const res = await httpGet('https://gemini.google.com/', timeout)
    if (res.status === 200) {
      // 检查是否被阻止
      if (res.data.includes('not available') || res.data.includes('unavailable') || res.data.includes('not supported')) {
        return { status: 'locked' }
      }
      return { status: 'unlocked', region: 'Available' }
    } else if (res.status === 403) {
      return { status: 'locked' }
    }
    return { status: 'unlocked', region: 'Available' }
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : String(e) }
  }
}

// 辅助函数：根据域名查找连接记录
async function findConnectionByHost(domain: string): Promise<{ rule: string; rulePayload: string; proxy: string } | null> {
  try {
    const connections = await mihomoGetConnections()
    if (!connections?.connections) return null
    
    const conn = connections.connections.find(c => 
      c.metadata?.host?.toLowerCase() === domain.toLowerCase() ||
      c.metadata?.host?.toLowerCase().endsWith('.' + domain.toLowerCase())
    )
    
    if (conn) {
      // 关闭这个测试连接
      try {
        await mihomoCloseConnection(conn.id)
      } catch {
        // ignore
      }
      return {
        rule: conn.rule || '',
        rulePayload: conn.rulePayload || '',
        proxy: conn.chains?.[0] || ''
      }
    }
    return null
  } catch {
    return null
  }
}

function ipcErrorWrapper<T>( // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => Promise<T> // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...args: any[]) => Promise<T | { invokeError: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e && typeof e === 'object') {
        if ('message' in e) {
          return { invokeError: e.message }
        } else {
          return { invokeError: JSON.stringify(e) }
        }
      }
      if (e instanceof Error || typeof e === 'string') {
        return { invokeError: e }
      }
      return { invokeError: 'Unknown Error' }
    }
  }
}
export function registerIpcMainHandlers(): void {
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
  ipcMain.handle('updateProfileItem', (_e, item) => ipcErrorWrapper(updateProfileItem)(item))
  ipcMain.handle('changeCurrentProfile', (_e, id) => ipcErrorWrapper(changeCurrentProfile)(id))
  ipcMain.handle('addProfileItem', (_e, item) => ipcErrorWrapper(addProfileItem)(item))
  ipcMain.handle('removeProfileItem', (_e, id) => ipcErrorWrapper(removeProfileItem)(id))
  ipcMain.handle('getOverrideConfig', (_e, force) => ipcErrorWrapper(getOverrideConfig)(force))
  ipcMain.handle('setOverrideConfig', (_e, config) => ipcErrorWrapper(setOverrideConfig)(config))
  ipcMain.handle('getOverrideItem', (_e, id) => ipcErrorWrapper(getOverrideItem)(id))
  ipcMain.handle('addOverrideItem', (_e, item) => ipcErrorWrapper(addOverrideItem)(item))
  ipcMain.handle('removeOverrideItem', (_e, id) => ipcErrorWrapper(removeOverrideItem)(id))
  ipcMain.handle('updateOverrideItem', (_e, item) => ipcErrorWrapper(updateOverrideItem)(item))
  ipcMain.handle('getOverride', (_e, id, ext) => ipcErrorWrapper(getOverride)(id, ext))
  ipcMain.handle('setOverride', (_e, id, ext, str) => ipcErrorWrapper(setOverride)(id, ext, str))
  // 代理链
  ipcMain.handle('getChainsConfig', (_e, force) => ipcErrorWrapper(getChainsConfig)(force))
  ipcMain.handle('getAllChains', ipcErrorWrapper(getAllChains))
  ipcMain.handle('addChainItem', (_e, item) => ipcErrorWrapper(addChainItem)(item))
  ipcMain.handle('updateChainItem', (_e, item) => ipcErrorWrapper(updateChainItem)(item))
  ipcMain.handle('removeChainItem', (_e, id) => ipcErrorWrapper(removeChainItem)(id))
  ipcMain.handle('restartCore', ipcErrorWrapper(restartCore))
  ipcMain.handle('restartMihomoConnections', ipcErrorWrapper(restartMihomoConnections))
  ipcMain.handle('startMonitor', (_e, detached) => ipcErrorWrapper(startMonitor)(detached))
  ipcMain.handle('triggerSysProxy', (_e, enable, onlyActiveDevice) =>
    ipcErrorWrapper(triggerSysProxy)(enable, onlyActiveDevice)
  )
  ipcMain.handle('manualGrantCorePermition', (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
    ipcErrorWrapper(manualGrantCorePermition)(cores)
  )
  ipcMain.handle('checkCorePermission', () => ipcErrorWrapper(checkCorePermission)())
  ipcMain.handle('revokeCorePermission', (_e, cores?: ('mihomo' | 'mihomo-alpha')[]) =>
    ipcErrorWrapper(revokeCorePermission)(cores)
  )
  ipcMain.handle('checkElevateTask', () => ipcErrorWrapper(checkElevateTask)())
  ipcMain.handle('deleteElevateTask', () => ipcErrorWrapper(deleteElevateTask)())
  ipcMain.handle('serviceStatus', () => ipcErrorWrapper(serviceStatus)())
  ipcMain.handle('testServiceConnection', () => ipcErrorWrapper(testServiceConnection)())
  ipcMain.handle('initService', () => ipcErrorWrapper(initService)())
  ipcMain.handle('installService', () => ipcErrorWrapper(installService)())
  ipcMain.handle('uninstallService', () => ipcErrorWrapper(uninstallService)())
  ipcMain.handle('startService', () => ipcErrorWrapper(startService)())
  ipcMain.handle('restartService', () => ipcErrorWrapper(restartService)())
  ipcMain.handle('stopService', () => ipcErrorWrapper(stopService)())
  ipcMain.handle('findSystemMihomo', () => findSystemMihomo())
  ipcMain.handle('getFilePath', (_e, ext) => getFilePath(ext))
  ipcMain.handle('saveFile', (_e, content, defaultName, ext) => saveFile(content, defaultName, ext))
  ipcMain.handle('readTextFile', (_e, filePath) => ipcErrorWrapper(readTextFile)(filePath))
  ipcMain.handle('getRuntimeConfigStr', ipcErrorWrapper(getRuntimeConfigStr))
  ipcMain.handle('getRawProfileStr', ipcErrorWrapper(getRawProfileStr))
  ipcMain.handle('getCurrentProfileStr', ipcErrorWrapper(getCurrentProfileStr))
  ipcMain.handle('getOverrideProfileStr', ipcErrorWrapper(getOverrideProfileStr))
  ipcMain.handle('getRuntimeConfig', ipcErrorWrapper(getRuntimeConfig))
  ipcMain.handle('downloadAndInstallUpdate', (_e, version) =>
    ipcErrorWrapper(downloadAndInstallUpdate)(version)
  )
  ipcMain.handle('checkUpdate', ipcErrorWrapper(checkUpdate))
  ipcMain.handle('cancelUpdate', ipcErrorWrapper(cancelUpdate))
  ipcMain.handle('getVersion', () => app.getVersion())
  ipcMain.handle('platform', () => process.platform)
  ipcMain.handle('openUWPTool', ipcErrorWrapper(openUWPTool))
  ipcMain.handle('setupFirewall', ipcErrorWrapper(setupFirewall))
  ipcMain.handle('getInterfaces', getInterfaces)
  ipcMain.handle('webdavBackup', ipcErrorWrapper(webdavBackup))
  ipcMain.handle('webdavRestore', (_e, filename) => ipcErrorWrapper(webdavRestore)(filename))
  ipcMain.handle('listWebdavBackups', ipcErrorWrapper(listWebdavBackups))
  ipcMain.handle('webdavDelete', (_e, filename) => ipcErrorWrapper(webdavDelete)(filename))
  ipcMain.handle('registerShortcut', (_e, oldShortcut, newShortcut, action) =>
    ipcErrorWrapper(registerShortcut)(oldShortcut, newShortcut, action)
  )
  ipcMain.handle('startSubStoreFrontendServer', () =>
    ipcErrorWrapper(startSubStoreFrontendServer)()
  )
  ipcMain.handle('stopSubStoreFrontendServer', () => ipcErrorWrapper(stopSubStoreFrontendServer)())
  ipcMain.handle('startSubStoreBackendServer', () => ipcErrorWrapper(startSubStoreBackendServer)())
  ipcMain.handle('stopSubStoreBackendServer', () => ipcErrorWrapper(stopSubStoreBackendServer)())
  ipcMain.handle('downloadSubStore', () => ipcErrorWrapper(downloadSubStore)())

  ipcMain.handle('subStorePort', () => subStorePort)
  ipcMain.handle('subStoreFrontendPort', () => subStoreFrontendPort)
  ipcMain.handle('subStoreSubs', () => ipcErrorWrapper(subStoreSubs)())
  ipcMain.handle('subStoreCollections', () => ipcErrorWrapper(subStoreCollections)())
  ipcMain.handle('getGistUrl', ipcErrorWrapper(getGistUrl))
  ipcMain.handle('setNativeTheme', (_e, theme) => {
    setNativeTheme(theme)
  })
  ipcMain.handle('setTitleBarOverlay', (_e, overlay) =>
    ipcErrorWrapper(async (overlay): Promise<void> => {
      if (typeof mainWindow?.setTitleBarOverlay === 'function') {
        mainWindow.setTitleBarOverlay(overlay)
      }
    })(overlay)
  )
  ipcMain.handle('setAlwaysOnTop', (_e, alwaysOnTop) => {
    mainWindow?.setAlwaysOnTop(alwaysOnTop)
  })
  ipcMain.handle('isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop()
  })
  ipcMain.handle('showTrayIcon', () => ipcErrorWrapper(showTrayIcon)())
  ipcMain.handle('closeTrayIcon', () => ipcErrorWrapper(closeTrayIcon)())
  ipcMain.handle('setDockVisible', (_e, visible: boolean) => setDockVisible(visible))
  ipcMain.handle('showMainWindow', showMainWindow)
  ipcMain.handle('closeMainWindow', closeMainWindow)
  ipcMain.handle('windowMin', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('windowMax', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('triggerMainWindow', triggerMainWindow)
  ipcMain.handle('showFloatingWindow', () => ipcErrorWrapper(showFloatingWindow)())
  ipcMain.handle('closeFloatingWindow', () => ipcErrorWrapper(closeFloatingWindow)())
  ipcMain.handle('showContextMenu', () => ipcErrorWrapper(showContextMenu)())
  ipcMain.handle('openFile', (_e, type, id, ext) => openFile(type, id, ext))
  ipcMain.handle('openDevTools', () => {
    mainWindow?.webContents.openDevTools()
  })
  ipcMain.handle('createHeapSnapshot', () => {
    v8.writeHeapSnapshot(path.join(logDir(), `${Date.now()}.heapsnapshot`))
  })
  ipcMain.handle('getUserAgent', () => ipcErrorWrapper(getUserAgent)())
  ipcMain.handle('getAppName', (_e, appPath) => ipcErrorWrapper(getAppName)(appPath))
  ipcMain.handle('getImageDataURL', (_e, url) => ipcErrorWrapper(getImageDataURL)(url))
  ipcMain.handle('getIconDataURL', (_e, appPath) => ipcErrorWrapper(getIconDataURL)(appPath))
  ipcMain.handle('getTrafficStats', () => getTrafficStats())
  ipcMain.handle('clearTrafficStats', () => clearTrafficStats())
  ipcMain.handle('getProcessTrafficRanking', (_e, type: 'session' | 'today', sortBy: 'upload' | 'download') => getProcessTrafficRanking(type, sortBy))
  ipcMain.handle('getProviderStats', () => getProviderStats())
  ipcMain.handle('clearProviderStats', () => clearProviderStats())
  ipcMain.handle('triggerProviderSnapshot', async () => {
    await triggerSnapshot()
    return getProviderStats()
  })
  ipcMain.handle('fetchIpInfo', ipcErrorWrapper(async () => {
    return new Promise((resolve, reject) => {
      const request = net.request('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query')
      let data = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString()
        })
        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch {
            reject(new Error('解析失败'))
          }
        })
      })
      request.on('error', (error) => {
        reject(error)
      })
      request.end()
    })
  }))

  // Helper for DNS Resolution
  const resolveToIp = async (query: string): Promise<string> => {
    try {
      const net = await import('net')
      if (net.isIP(query) !== 0) return query
      
      const dns = await import('dns')
      const { address } = await dns.promises.lookup(query)
      return address
    } catch {
      return query
    }
  }

  ipcMain.handle('fetchIpInfoQuery', ipcErrorWrapper(async (_e, query: string) => {
    const ip = await resolveToIp(query)
    return new Promise((resolve, reject) => {
      const request = net.request(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`)
      let data = ''
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString()
        })
        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            // Restore original query field if it differs
            if (json.query !== query) json.query = query 
            resolve(json)
          } catch {
            reject(new Error('解析失败'))
          }
        })
      })
      request.on('error', (error) => {
        reject(error)
      })
      request.end()
    })
  }))

  ipcMain.handle('fetchBatchIpInfo', ipcErrorWrapper(async (_e, queries: any[]) => {
    // Pre-resolve all queries
    const resolvedQueries = await Promise.all(queries.map(async (q) => {
        if (q.query) {
            const ip = await resolveToIp(q.query)
            return { ...q, query: ip, originalQuery: q.query }
        }
        return q
    }))

    return new Promise((resolve, reject) => {
      try {
        const request = net.request({
          url: 'http://ip-api.com/batch',
          method: 'POST'
        })
        
        request.setHeader('Content-Type', 'application/json')
        
        // Send resolved IPs
        const body = JSON.stringify(resolvedQueries)
        request.write(body)
        
        let data = ''
        request.on('response', (response) => {
          response.on('data', (chunk) => {
            data += chunk.toString()
          })
          response.on('end', () => {
            try {
              const json = JSON.parse(data)
              // Map back to original queries if needed, or rely on renderer to handle map
              // ip-api batch returns array in same order. 
              // We should restore the original 'query' field so the Map in renderer (which uses domain as key) can find it.
              if (Array.isArray(json)) {
                  json.forEach((item, index) => {
                      if (resolvedQueries[index].originalQuery) {
                          item.query = resolvedQueries[index].originalQuery
                      }
                  })
              }
              resolve(json)
            } catch {
              reject(new Error('解析失败'))
            }
          })
        })
        request.on('error', (error) => {
          reject(error)
        })
        request.end()
      } catch (e) {
        reject(e)
      }
    })
  }))
  ipcMain.handle('testRuleMatch', async (_e, domain: string) => {
    try {
      // 发起一个请求来触发规则匹配
      return await new Promise((resolve) => {
        const url = `http://${domain}/`
        
        // 辅助函数：安全地处理结果
        const resolveResult = async () => {
            try {
                // 等待一下让连接记录更新
                await new Promise(r => setTimeout(r, 500))
                const result = await findConnectionByHost(domain)
                resolve(result)
            } catch (e) {
                // 出错也尽量返回 null 而不是抛出异常
                resolve(null)
            }
        }

        try {
            const request = net.request({ url, method: 'HEAD' })
            
            // 设置超时
            const timeout = setTimeout(() => {
              try { request.abort() } catch { /* ignore */ }
              resolveResult()
            }, 3000)
            
            request.on('response', () => {
              clearTimeout(timeout)
              try { request.abort() } catch { /* ignore */ }
              resolveResult()
            })
            
            request.on('error', () => {
              clearTimeout(timeout)
              resolveResult()
            })
            
            request.end()
        } catch (e) {
            // request 创建失败（如 URL 错误）
            resolveResult()
        }
      })
    } catch (e) {
      return { invokeError: e instanceof Error ? e.message : String(e) }
    }
  })
  ipcMain.handle('testConnectivity', async (_e, url: string, timeout: number = 5000) => {
    try {
      return await new Promise((resolve) => {
        const startTime = Date.now()
        const request = net.request({ url, method: 'GET' })
        
        const timer = setTimeout(() => {
          request.abort()
          resolve({ success: false, latency: -1, error: '超时' })
        }, timeout)
        
        request.on('response', (response) => {
          clearTimeout(timer)
          const latency = Date.now() - startTime
          // 收到响应就立即中止，不需要读取内容
          request.abort()
          resolve({ success: response.statusCode < 400, latency, status: response.statusCode })
        })
        
        request.on('error', (error) => {
          clearTimeout(timer)
          resolve({ success: false, latency: -1, error: error.message })
        })
        
        request.end()
      })
    } catch (e) {
      return { success: false, latency: -1, error: e instanceof Error ? e.message : String(e) }
    }
  })
  // 流媒体解锁检测
  ipcMain.handle('checkStreamingUnlock', async (_e, service: string) => {
    try {
      return await checkStreamingService(service)
    } catch (e) {
      return { status: 'error', region: '', error: e instanceof Error ? e.message : String(e) }
    }
  })
  ipcMain.handle('resolveThemes', () => ipcErrorWrapper(resolveThemes)())
  ipcMain.handle('fetchThemes', () => ipcErrorWrapper(fetchThemes)())
  ipcMain.handle('importThemes', (_e, file) => ipcErrorWrapper(importThemes)(file))
  ipcMain.handle('readTheme', (_e, theme) => ipcErrorWrapper(readTheme)(theme))
  ipcMain.handle('writeTheme', (_e, theme, css) => ipcErrorWrapper(writeTheme)(theme, css))
  ipcMain.handle('applyTheme', (_e, theme) => ipcErrorWrapper(applyTheme)(theme))
  ipcMain.handle('copyEnv', (_e, type) => ipcErrorWrapper(copyEnv)(type))
  ipcMain.handle('alert', (_e, msg) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      // alert 通常用于普通提示或警告，使用 warning 样式比较合适
      mainWindow.webContents.send('show-dialog-modal', 'warning', '提示', msg)
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else {
      dialog.showErrorBox('RouteX', msg)
    }
  })
  ipcMain.handle('resetAppConfig', resetAppConfig)
  ipcMain.handle('relaunchApp', () => {
    setNotQuitDialog()
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle('quitWithoutCore', ipcErrorWrapper(quitWithoutCore))
  ipcMain.handle('startNetworkDetection', ipcErrorWrapper(startNetworkDetection))
  ipcMain.handle('stopNetworkDetection', ipcErrorWrapper(stopNetworkDetection))
  ipcMain.handle('quitApp', () => app.quit())
  ipcMain.handle('notDialogQuit', () => {
    setNotQuitDialog()
    app.quit()
  })
  // 网络健康监控
  ipcMain.handle('startNetworkHealthMonitor', () => {
    startNetworkHealthMonitor()
  })
  ipcMain.handle('stopNetworkHealthMonitor', () => {
    stopNetworkHealthMonitor()
  })
  ipcMain.handle('getNetworkHealthStats', () => {
    return getNetworkHealthStats()
  })
  ipcMain.handle('getAppUptime', () => process.uptime())
  ipcMain.handle('getAppMemory', async () => {
    const metrics = await process.getProcessMemoryInfo()
    return metrics.private
  })
  ipcMain.handle('testDNSLatency', async (_e, domain: string) => {
    const start = Date.now()
    try {
      await mihomoDnsQuery(domain, 'A')
      return Math.max(1, Date.now() - start)
    } catch {
      // Fallback to system DNS
      try {
        const dns = await import('dns')
        await dns.promises.resolve(domain)
        return Math.max(1, Date.now() - start)
      } catch {
        return -1
      }
    }
  })
}
