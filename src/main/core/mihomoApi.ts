import axios, { AxiosInstance } from 'axios'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { mainWindow } from '..'
import WebSocket from 'ws'
import { tray } from '../resolve/tray'
import { calcTraffic } from '../utils/calc'
import { getRuntimeConfig } from './factory'
import { floatingWindow } from '../resolve/floatingWindow'
import { mihomoIpcPath } from '../utils/dirs'
import { updateTrafficStats, updateProcessTraffic, resetTrafficDelta } from '../resolve/trafficStats'

let axiosIns: AxiosInstance = null!
let mihomoTrafficWs: WebSocket | null = null
let trafficRetry = 10
let mihomoMemoryWs: WebSocket | null = null
let memoryRetry = 10
let totalUpload = 0
let totalDownload = 0
let mihomoLogsWs: WebSocket | null = null
let logsRetry = 10
let mihomoConnectionsWs: WebSocket | null = null
let connectionsRetry = 10

export const getAxios = async (force: boolean = false): Promise<AxiosInstance> => {
  const currentSocketPath = mihomoIpcPath()

  if (axiosIns && axiosIns.defaults.socketPath !== currentSocketPath) {
    force = true
  }

  if (axiosIns && !force) return axiosIns

  axiosIns = axios.create({
    baseURL: `http://localhost`,
    socketPath: currentSocketPath,
    timeout: 15000
  })

  axiosIns.interceptors.response.use(
    (response) => {
      return response.data
    },
    (error) => {
      if (error.response && error.response.data) {
        return Promise.reject(error.response.data)
      }
      return Promise.reject(error)
    }
  )
  return axiosIns
}

export async function mihomoVersion(): Promise<ControllerVersion> {
  const instance = await getAxios()
  return await instance.get('/version')
}

export const mihomoConfig = async (): Promise<ControllerConfigs> => {
  const instance = await getAxios()
  return await instance.get('/configs')
}

export const patchMihomoConfig = async (patch: Partial<ControllerConfigs>): Promise<void> => {
  const instance = await getAxios()
  return await instance.patch('/configs', patch)
}

export const mihomoCloseConnection = async (id: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.delete(`/connections/${encodeURIComponent(id)}`)
}

export const mihomoGetConnections = async (): Promise<ControllerConnections> => {
  const instance = await getAxios()
  return await instance.get('/connections')
}

export const mihomoCloseAllConnections = async (name?: string): Promise<void> => {
  const instance = await getAxios()
  if (name) {
    const connectionsInfo = await mihomoGetConnections()
    const targetConnections =
      connectionsInfo?.connections?.filter((conn) => conn.chains && conn.chains.includes(name)) ||
      []
    for (const conn of targetConnections) {
      try {
        await mihomoCloseConnection(conn.id)
      } catch (error) {
        // ignore
      }
    }
  } else {
    return await instance.delete('/connections')
  }
}

export const mihomoRules = async (): Promise<ControllerRules> => {
  const instance = await getAxios()
  return await instance.get('/rules')
}

export const mihomoToggleRuleDisabled = async (data: Record<number, boolean>): Promise<void> => {
  const instance = await getAxios()
  return await instance.patch('/rules/disable', data)
}

export const mihomoProxies = async (): Promise<ControllerProxies> => {
  const instance = await getAxios()
  return await instance.get('/proxies')
}

export const mihomoGroups = async (): Promise<ControllerMixedGroup[]> => {
  const { mode = 'rule' } = await getControledMihomoConfig()
  if (mode === 'direct') return []
  const proxies = await mihomoProxies()
  const runtime = await getRuntimeConfig()
  const groups: ControllerMixedGroup[] = []
  
  // 创建一个 icon 映射表
  const iconMap: Record<string, string> = {}
  runtime?.['proxy-groups']?.forEach((group: { name: string; icon?: string }) => {
    if (group.icon) {
      iconMap[group.name] = group.icon
    }
  })
  
  runtime?.['proxy-groups']?.forEach((group: { name: string; url?: string; icon?: string }) => {
    const { name, url, icon } = group
    if (proxies.proxies[name] && 'all' in proxies.proxies[name] && !proxies.proxies[name].hidden) {
      const newGroup = { ...proxies.proxies[name] }
      // 只有当 url 存在且非空时才覆盖，避免覆盖为 undefined 或空字符串
      if (url && url.length > 0) {
        newGroup.testUrl = url
      }
      if (icon) newGroup.icon = icon
      // 为 all 数组中的每个代理/组也添加 icon
      const newAll = newGroup.all.map((proxyName: string) => {
        const proxy = { ...proxies.proxies[proxyName] }
        if (iconMap[proxyName]) {
          proxy.icon = iconMap[proxyName]
        }
        return proxy
      })
      groups.push({ ...newGroup, all: newAll } as ControllerMixedGroup)
    }
  })
  if (!groups.find((group) => group.name === 'GLOBAL')) {
    const newGlobal = proxies.proxies['GLOBAL'] as ControllerGroupDetail
    if (!newGlobal.hidden) {
      const newAll = newGlobal.all.map((name) => {
        const proxy = { ...proxies.proxies[name] }
        if (iconMap[name]) {
          proxy.icon = iconMap[name]
        }
        return proxy
      })
      groups.push({ ...newGlobal, all: newAll })
    }
  }
  if (mode === 'global') {
    const global = groups.findIndex((group) => group.name === 'GLOBAL')
    groups.unshift(groups.splice(global, 1)[0])
  }
  return groups
}

export const mihomoProxyProviders = async (): Promise<ControllerProxyProviders> => {
  const instance = await getAxios()
  return await instance.get('/providers/proxies')
}

export const mihomoUpdateProxyProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.put(`/providers/proxies/${encodeURIComponent(name)}`)
}

export const mihomoRuleProviders = async (): Promise<ControllerRuleProviders> => {
  const instance = await getAxios()
  return await instance.get('/providers/rules')
}

export const mihomoUpdateRuleProviders = async (name: string): Promise<void> => {
  const instance = await getAxios()
  return await instance.put(`/providers/rules/${encodeURIComponent(name)}`)
}

export const mihomoChangeProxy = async (
  group: string,
  proxy: string
): Promise<ControllerProxiesDetail> => {
  const instance = await getAxios()
  return await instance.put(`/proxies/${encodeURIComponent(group)}`, { name: proxy })
}

export const mihomoUnfixedProxy = async (group: string): Promise<ControllerProxiesDetail> => {
  const instance = await getAxios()
  return await instance.delete(`/proxies/${encodeURIComponent(group)}`)
}

export const mihomoProxyDelay = async (
  proxy: string,
  url?: string
): Promise<ControllerProxiesDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  // 优先使用传入的 URL，如果没有则使用全局配置，最后兜底默认值
  const finalUrl = (url && url.length > 0) ? url : (delayTestUrl || 'http://cp.cloudflare.com/generate_204')
  
  const timeoutVal = parseInt(String(delayTestTimeout || 5000))


  return await instance.get(`/proxies/${encodeURIComponent(proxy)}/delay`, {
    params: {
      url: finalUrl,
      timeout: timeoutVal
    }
  })
}

export const mihomoGroupDelay = async (
  group: string,
  url?: string
): Promise<ControllerGroupDelay> => {
  const appConfig = await getAppConfig()
  const { delayTestUrl, delayTestTimeout } = appConfig
  const instance = await getAxios()
  // 优先使用传入的 URL，如果没有则使用全局配置，最后兜底默认值
  const finalUrl = (url && url.length > 0) ? url : (delayTestUrl || 'http://cp.cloudflare.com/generate_204')

  const timeoutVal = parseInt(String(delayTestTimeout || 5000))


  return await instance.get(`/group/${encodeURIComponent(group)}/delay`, {
    params: {
      url: finalUrl,
      timeout: timeoutVal
    }
  })
}

export const mihomoUpgrade = async (): Promise<void> => {
  if (process.platform === 'win32') await patchMihomoConfig({ 'log-level': 'info' })
  const instance = await getAxios()
  return await instance.post('/upgrade')
}

export const mihomoUpgradeGeo = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.post('/upgrade/geo')
}

export const mihomoUpgradeUI = async (): Promise<void> => {
  const instance = await getAxios()
  return await instance.post('/upgrade/ui')
}

export const checkMihomoLatestVersion = async (isAlpha: boolean): Promise<string | null> => {
  try {
    const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
    const versionUrl = isAlpha
      ? 'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
      : 'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'
    
    const res = await axios.get(versionUrl, {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      },
      timeout: 10000,
      responseType: 'text'
    })
    return res.data.trim()
  } catch {
    return null
  }
}

export const mihomoDnsQuery = async (name: string, type: string): Promise<{ Answer?: { data: string }[] }> => {
  const instance = await getAxios()
  return await instance.get('/dns/query', { params: { name, type } })
}

export const startMihomoTraffic = async (): Promise<void> => {
  await mihomoTraffic()
}

export const stopMihomoTraffic = (): void => {
  if (mihomoTrafficWs) {
    mihomoTrafficWs.removeAllListeners()
    if (mihomoTrafficWs.readyState === WebSocket.OPEN) {
      mihomoTrafficWs.close()
    }
    mihomoTrafficWs = null
  }
  // 重置累计流量和增量基准，避免核心重启后统计错误
  totalUpload = 0
  totalDownload = 0
  resetTrafficDelta()
}

const mihomoTraffic = async (): Promise<void> => {
  mihomoTrafficWs = new WebSocket(`ws+unix:${mihomoIpcPath()}:/traffic`)

  mihomoTrafficWs.onmessage = async (e): Promise<void> => {
    const data = e.data as string
    const json = JSON.parse(data) as ControllerTraffic
    trafficRetry = 10
    
    // 累计流量并更新统计
    totalUpload += json.up
    totalDownload += json.down
    updateTrafficStats(totalUpload, totalDownload)
    
    try {
      mainWindow?.webContents.send('mihomoTraffic', json)
      if (process.platform !== 'linux') {
        tray?.setToolTip(
          '↑' +
            `${calcTraffic(json.up)}/s`.padStart(9) +
            '\n↓' +
            `${calcTraffic(json.down)}/s`.padStart(9)
        )
      }
      floatingWindow?.webContents.send('mihomoTraffic', json)
    } catch {
      // ignore
    }
  }

  mihomoTrafficWs.onclose = (): void => {
    if (trafficRetry) {
      trafficRetry--
      mihomoTraffic()
    }
  }

  mihomoTrafficWs.onerror = (): void => {
    if (mihomoTrafficWs) {
      mihomoTrafficWs.close()
      mihomoTrafficWs = null
    }
  }
}

export const startMihomoMemory = async (): Promise<void> => {
  await mihomoMemory()
}

export const stopMihomoMemory = (): void => {
  if (mihomoMemoryWs) {
    mihomoMemoryWs.removeAllListeners()
    if (mihomoMemoryWs.readyState === WebSocket.OPEN) {
      mihomoMemoryWs.close()
    }
    mihomoMemoryWs = null
  }
}

const mihomoMemory = async (): Promise<void> => {
  mihomoMemoryWs = new WebSocket(`ws+unix:${mihomoIpcPath()}:/memory`)

  mihomoMemoryWs.onmessage = (e): void => {
    const data = e.data as string
    memoryRetry = 10
    try {
      mainWindow?.webContents.send('mihomoMemory', JSON.parse(data) as ControllerMemory)
    } catch {
      // ignore
    }
  }

  mihomoMemoryWs.onclose = (): void => {
    if (memoryRetry) {
      memoryRetry--
      mihomoMemory()
    }
  }

  mihomoMemoryWs.onerror = (): void => {
    if (mihomoMemoryWs) {
      mihomoMemoryWs.close()
      mihomoMemoryWs = null
    }
  }
}

export const startMihomoLogs = async (): Promise<void> => {
  await mihomoLogs()
}

export const stopMihomoLogs = (): void => {
  if (mihomoLogsWs) {
    mihomoLogsWs.removeAllListeners()
    if (mihomoLogsWs.readyState === WebSocket.OPEN) {
      mihomoLogsWs.close()
    }
    mihomoLogsWs = null
  }
}

const mihomoLogs = async (): Promise<void> => {
  const { 'log-level': logLevel = 'info' } = await getControledMihomoConfig()

  mihomoLogsWs = new WebSocket(`ws+unix:${mihomoIpcPath()}:/logs?level=${logLevel}`)

  mihomoLogsWs.onmessage = (e): void => {
    const data = e.data as string
    logsRetry = 10
    try {
      mainWindow?.webContents.send('mihomoLogs', JSON.parse(data) as ControllerLog)
    } catch {
      // ignore
    }
  }

  mihomoLogsWs.onclose = (): void => {
    if (logsRetry) {
      logsRetry--
      mihomoLogs()
    }
  }

  mihomoLogsWs.onerror = (): void => {
    if (mihomoLogsWs) {
      mihomoLogsWs.close()
      mihomoLogsWs = null
    }
  }
}

export const startMihomoConnections = async (): Promise<void> => {
  await mihomoConnections()
}

export const stopMihomoConnections = (): void => {
  if (mihomoConnectionsWs) {
    mihomoConnectionsWs.removeAllListeners()
    if (mihomoConnectionsWs.readyState === WebSocket.OPEN) {
      mihomoConnectionsWs.close()
    }
    mihomoConnectionsWs = null
  }
}

export const restartMihomoConnections = async (): Promise<void> => {
  stopMihomoConnections()
  await startMihomoConnections()
}

const mihomoConnections = async (): Promise<void> => {
  const { connectionInterval = 500 } = await getAppConfig()
  mihomoConnectionsWs = new WebSocket(
    `ws+unix:${mihomoIpcPath()}:/connections?interval=${connectionInterval}`
  )

  mihomoConnectionsWs.onmessage = (e): void => {
    const data = e.data as string
    connectionsRetry = 10
    try {
      const connectionsData = JSON.parse(data) as ControllerConnections
      mainWindow?.webContents.send('mihomoConnections', connectionsData)
      // 更新进程流量统计
      if (connectionsData.connections) {
        updateProcessTraffic(connectionsData.connections)
      }
    } catch {
      // ignore
    }
  }

  mihomoConnectionsWs.onclose = (): void => {
    if (connectionsRetry) {
      connectionsRetry--
      mihomoConnections()
    }
  }

  mihomoConnectionsWs.onerror = (): void => {
    if (mihomoConnectionsWs) {
      mihomoConnectionsWs.close()
      mihomoConnectionsWs = null
    }
  }
}
