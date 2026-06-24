import { C, invokeSafe } from './ipc-core'
import { createDefaultControledMihomoConfig } from '../../../shared/defaults/runtime'
import { ON, onIpc } from './ipc-channels'
import { createTauriRuntimeConfig, buildRuntimeGroupsFallback } from './mihomo-config-merge'
import { mihomoConfigCache } from './mihomo-config-cache'
import { MihomoSocketManager } from './mihomo-socket-manager'

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

export function isExpectedMihomoUnavailableError(error: unknown): boolean {
  const message = `${error ?? ''}`
  return (
    message.includes('connect ENOENT \\\\.\\pipe\\RouteX\\mihomo') ||
    message.includes('Mihomo core is not running') ||
    message.includes('socket hang up') ||
    message.includes('connection refused') ||
    message.includes('Connection refused') ||
    message.includes('ECONNREFUSED') ||
    message.includes('Timed out waiting for Mihomo controller') ||
    message.includes('Mihomo controller is not available') ||
    message.includes('503 Service Unavailable') ||
    message.includes('504 Gateway Timeout')
  )
}

function getDefaultTauriControledMihomoConfig(): Partial<MihomoConfig> {
  return createDefaultControledMihomoConfig(__ROUTEX_PLATFORM__)
}

function readTauriControledMihomoConfig(): Partial<MihomoConfig> {
  return {
    ...getDefaultTauriControledMihomoConfig(),
    ...(mihomoConfigCache.getControlledConfig() || {})
  }
}

const mihomoSocketManager = new MihomoSocketManager({
  getRuntimeConfig,
  readTauriControledMihomoConfig,
  invalidateRuntimeConfigCache: () => mihomoConfigCache.invalidateRuntimeConfigCache()
})

export function stopTauriMihomoEventBridge(): void {
  mihomoSocketManager.stopTauriMihomoEventBridge()
}

export function onTauriBridgeConnectionsReady(listener: () => void): () => void {
  return mihomoSocketManager.onTauriBridgeConnectionsReady(listener)
}

export function retainTauriConnectionsBridge(): () => void {
  return mihomoSocketManager.retainTauriConnectionsBridge()
}

export function retainTauriMemoryBridge(): () => void {
  return mihomoSocketManager.retainTauriMemoryBridge()
}

export function retainTauriLogsBridge(): () => void {
  return mihomoSocketManager.retainTauriLogsBridge()
}

export function startTauriMihomoEventBridge(reason = 'manual'): void {
  mihomoSocketManager.startTauriMihomoEventBridge(reason)
}

export function onTauriRealtimeTraffic(listener: (info: ControllerTraffic) => void): () => void {
  if (!isTauriHost()) {
    return () => undefined
  }

  return onIpc<[ControllerTraffic]>(ON.mihomoTraffic, (_event, info) => {
    listener(info)
  })
}

export function subscribeDesktopTraffic(
  listener: (info: ControllerTraffic) => void,
  startBridge = false
): () => void {
  if (isTauriHost()) {
    if (startBridge) {
      startTauriMihomoEventBridge()
    }
    return onTauriRealtimeTraffic(listener)
  }

  return onIpc<[ControllerTraffic]>(ON.mihomoTraffic, (_event, info) => {
    listener(info)
  })
}

function createTauriControllerConfig(): ControllerConfigs {
  const config = readTauriControledMihomoConfig()
  return {
    port: config.port ?? 0,
    'socks-port': config['socks-port'] ?? 0,
    'redir-port': config['redir-port'] ?? 0,
    'tproxy-port': config['tproxy-port'] ?? 0,
    'mixed-port': config['mixed-port'] ?? 7890,
    tun: {
      enable: config.tun?.enable ?? false,
      device: config.tun?.device ?? '',
      stack: config.tun?.stack ?? 'mixed',
      'dns-hijack': config.tun?.['dns-hijack'] ?? [],
      'auto-route': config.tun?.['auto-route'] ?? true,
      'auto-redirect': config.tun?.['auto-redirect'] ?? false,
      'auto-detect-interface': config.tun?.['auto-detect-interface'] ?? true,
      mtu: config.tun?.mtu ?? 1500,
      'inet4-address': [],
      'inet6-address': [],
      'file-descriptor': 0
    },
    authentication: config.authentication ?? [],
    'skip-auth-prefixes': config['skip-auth-prefixes'] ?? [],
    'lan-allowed-ips': config['lan-allowed-ips'] ?? [],
    'lan-disallowed-ips': config['lan-disallowed-ips'] ?? [],
    'allow-lan': config['allow-lan'] ?? false,
    'bind-address': config['bind-address'] ?? '*',
    'inbound-tfo': false,
    'inbound-mptcp': false,
    mode: config.mode ?? 'rule',
    'unified-delay': config['unified-delay'] ?? false,
    'log-level': config['log-level'] ?? 'info',
    ipv6: config.ipv6 ?? true,
    'interface-name': config['interface-name'] ?? '',
    'routing-mark': 0,
    'geox-url': {
      mmdb: config['geox-url']?.mmdb ?? '',
      asn: config['geox-url']?.asn ?? '',
      'geo-ip': config['geox-url']?.geoip ?? '',
      'geo-site': config['geox-url']?.geosite ?? ''
    },
    'geo-auto-update': config['geo-auto-update'] ?? false,
    'geo-update-interval': config['geo-update-interval'] ?? 24,
    'geodata-mode': config['geodata-mode'] ?? false,
    'geodata-loader': 'standard',
    'geosite-matcher': 'succinct',
    'tcp-concurrent': config['tcp-concurrent'] ?? false,
    'find-process-mode': config['find-process-mode'] ?? 'always',
    sniffing: true,
    'global-ua': '',
    'etag-support': false,
    'keep-alive-idle': config['keep-alive-idle'] ?? 0,
    'keep-alive-interval': config['keep-alive-interval'] ?? 0,
    'disable-keep-alive': config['disable-keep-alive'] ?? false
  }
}

function createTauriRuntimeConfigWrapper(input?: Partial<MihomoConfig>): MihomoConfig {
  return createTauriRuntimeConfig(input, readTauriControledMihomoConfig(), __ROUTEX_PLATFORM__)
}

export async function ensureMihomoCoreAvailable(core: 'mihomo' | 'mihomo-alpha'): Promise<string> {
  return invokeSafe(C.ensureMihomoCoreAvailable, core)
}

export async function mihomoVersion(): Promise<ControllerVersion> {
  return invokeSafe(C.mihomoVersion)
}

export async function mihomoConfig(): Promise<ControllerConfigs> {
  if (isTauriHost()) {
    try {
      return await invokeSafe(C.mihomoConfig)
    } catch {
      return createTauriControllerConfig()
    }
  }

  return invokeSafe(C.mihomoConfig)
}

export async function mihomoRules(): Promise<ControllerRules> {
  return mihomoConfigCache.dedupeRequest(C.mihomoRules, () => invokeSafe(C.mihomoRules))
}

export async function mihomoProxies(): Promise<ControllerProxies> {
  return mihomoConfigCache.dedupeRequest(C.mihomoProxies, () => invokeSafe(C.mihomoProxies))
}

export async function mihomoConnections(): Promise<ControllerConnections> {
  return invokeSafe(C.mihomoConnections)
}

export async function mihomoGroups(): Promise<ControllerMixedGroup[]> {
  return mihomoConfigCache.dedupeRequest(C.mihomoGroups, async () => {
    if (isTauriHost()) {
      try {
        return await invokeSafe(C.mihomoGroups)
      } catch (error) {
        if (!isExpectedMihomoUnavailableError(error)) {
          throw error
        }

        const runtime = await getRuntimeConfig()
        return buildRuntimeGroupsFallback(runtime)
      }
    }

    return invokeSafe(C.mihomoGroups)
  })
}

export function clearMihomoGroupsRequestCache(): void {
  mihomoConfigCache.clearInFlightRequests(C.mihomoGroups)
}

export async function mihomoCloseConnection(id: string): Promise<void> {
  return invokeSafe(C.mihomoCloseConnection, id)
}

export async function mihomoRuleProviders(): Promise<ControllerRuleProviders> {
  return mihomoConfigCache.dedupeRequest(C.mihomoRuleProviders, () =>
    invokeSafe(C.mihomoRuleProviders)
  )
}

export async function mihomoProxyProviders(): Promise<ControllerProxyProviders> {
  return invokeSafe(C.mihomoProxyProviders)
}

export async function mihomoChangeProxy(
  group: string,
  proxy: string
): Promise<ControllerProxiesDetail> {
  const result = await invokeSafe<ControllerProxiesDetail>(C.mihomoChangeProxy, group, proxy)
  mihomoConfigCache.clearInFlightRequests(C.mihomoProxies)
  return result
}

export async function mihomoUnfixedProxy(group: string): Promise<ControllerProxiesDetail> {
  const result = await invokeSafe<ControllerProxiesDetail>(C.mihomoUnfixedProxy, group)
  mihomoConfigCache.clearInFlightRequests(C.mihomoProxies)
  return result
}

export async function mihomoGroupDelay(group: string, url?: string): Promise<ControllerGroupDelay> {
  const requestKey = mihomoConfigCache.createRequestKey(C.mihomoGroupDelay, group, url)
  const result = await mihomoConfigCache.dedupeRequest(requestKey, () =>
    invokeSafe<ControllerGroupDelay>(C.mihomoGroupDelay, group, url)
  )
  mihomoConfigCache.clearInFlightRequests(C.mihomoProxies)
  return result
}

export async function getRuntimeConfig(): Promise<MihomoConfig> {
  if (isTauriHost()) {
    const cachedRuntimeConfig = mihomoConfigCache.getRuntimeConfig()
    if (cachedRuntimeConfig) {
      return cachedRuntimeConfig
    }

    if (mihomoConfigCache.tauriRuntimeConfigPromise) {
      return mihomoConfigCache.tauriRuntimeConfigPromise
    }

    const requestRevision = mihomoConfigCache.tauriRuntimeConfigRevision
    const request = invokeSafe<Partial<MihomoConfig>>(C.getRuntimeConfig)
      .then((config) => {
        mihomoConfigCache.patchControlledConfig(config)
        mihomoSocketManager.syncTauriControllerUrlFromRuntime(config)
        const normalized = createTauriRuntimeConfigWrapper(config)

        if (requestRevision === mihomoConfigCache.tauriRuntimeConfigRevision) {
          mihomoConfigCache.setRuntimeConfig(normalized)
        }

        return mihomoConfigCache.getRuntimeConfig() || normalized
      })
      .catch(() => {
        const fallback = createTauriRuntimeConfigWrapper()

        if (requestRevision === mihomoConfigCache.tauriRuntimeConfigRevision) {
          mihomoConfigCache.setRuntimeConfig(fallback)
        }

        return mihomoConfigCache.getRuntimeConfig() || fallback
      })
      .finally(() => {
        if (mihomoConfigCache.tauriRuntimeConfigPromise === request) {
          mihomoConfigCache.tauriRuntimeConfigPromise = null
        }
      })

    mihomoConfigCache.tauriRuntimeConfigPromise = request
    return request
  }

  return mihomoConfigCache.dedupeRequest(C.getRuntimeConfig, () => invokeSafe(C.getRuntimeConfig))
}

export async function restartCore(): Promise<void> {
  if (isTauriHost()) {
    const result = (await invokeSafe(C.restartCore)) as { controller?: string } | undefined
    mihomoConfigCache.clearInFlightRequests(
      C.getRuntimeConfig,
      C.mihomoGroups,
      C.mihomoProxies,
      C.mihomoRules,
      C.mihomoRuleProviders
    )
    if (result?.controller) {
      mihomoSocketManager.writeTauriControllerUrl(`http://${result.controller}`)
      startTauriMihomoEventBridge()
    }
    return
  }

  await invokeSafe(C.restartCore)
  mihomoConfigCache.clearInFlightRequests(
    C.getRuntimeConfig,
    C.mihomoGroups,
    C.mihomoProxies,
    C.mihomoRules,
    C.mihomoRuleProviders
  )
}

export async function mihomoUpdateProxyProviders(name: string): Promise<void> {
  await invokeSafe(C.mihomoUpdateProxyProviders, name)
  mihomoConfigCache.clearInFlightRequests(C.mihomoProxies)
}

export async function mihomoUpdateRuleProviders(name: string): Promise<void> {
  await invokeSafe(C.mihomoUpdateRuleProviders, name)
  mihomoConfigCache.clearInFlightRequests(C.mihomoRuleProviders)
}

export async function mihomoProxyDelay(
  proxy: string,
  url?: string
): Promise<ControllerProxiesDelay> {
  const requestKey = mihomoConfigCache.createRequestKey(C.mihomoProxyDelay, proxy, url)
  const result = await mihomoConfigCache.dedupeRequest(requestKey, () =>
    invokeSafe<ControllerProxiesDelay>(C.mihomoProxyDelay, proxy, url)
  )
  mihomoConfigCache.clearInFlightRequests(C.mihomoProxies)
  return result
}

export async function mihomoToggleRuleDisabled(data: Record<number, boolean>): Promise<void> {
  await invokeSafe(C.mihomoToggleRuleDisabled, data)
  mihomoConfigCache.clearInFlightRequests(C.mihomoRules)
}

export async function checkMihomoLatestVersion(isAlpha: boolean): Promise<string | null> {
  const cached = mihomoConfigCache.getCachedLatestVersion(isAlpha)
  if (cached !== undefined) {
    return cached
  }

  const pending = mihomoConfigCache.getVersionPromise(isAlpha)
  if (pending) {
    return pending
  }

  const request = invokeSafe<string | null>(C.checkMihomoLatestVersion, isAlpha)
    .then((result) => {
      mihomoConfigCache.setCachedLatestVersion(isAlpha, result)
      return result
    })
    .finally(() => {
      mihomoConfigCache.deleteVersionPromise(isAlpha)
    })

  mihomoConfigCache.setVersionPromise(isAlpha, request)
  return request
}

export async function getControledMihomoConfig(force = false): Promise<Partial<MihomoConfig>> {
  if (isTauriHost()) {
    const config = await invokeSafe<Partial<MihomoConfig>>(C.getControledMihomoConfig, force)
    mihomoConfigCache.setControlledConfig(config)
    return readTauriControledMihomoConfig()
  }

  return invokeSafe(C.getControledMihomoConfig, force)
}

export async function patchControledMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  if (isTauriHost()) {
    await invokeSafe(C.patchControledMihomoConfig, patch)
    mihomoConfigCache.setControlledConfig({
      ...readTauriControledMihomoConfig(),
      ...patch
    })
    mihomoConfigCache.invalidateRuntimeConfigCache()
    mihomoConfigCache.clearInFlightRequests(C.getRuntimeConfig, C.mihomoGroups)
    return
  }

  await invokeSafe(C.patchControledMihomoConfig, patch)
  mihomoConfigCache.clearInFlightRequests(C.getRuntimeConfig, C.mihomoGroups)
}

export async function patchMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  if (isTauriHost()) {
    await invokeSafe(C.patchMihomoConfig, patch)
    mihomoConfigCache.clearInFlightRequests(C.getRuntimeConfig, C.mihomoGroups)
    return
  }

  await invokeSafe(C.patchMihomoConfig, patch)
  mihomoConfigCache.clearInFlightRequests(C.getRuntimeConfig, C.mihomoGroups)
}

export async function reloadCoreConfig(closeConnections = false): Promise<void> {
  await invokeSafe(C.reloadCoreConfig, closeConnections)
  if (isTauriHost()) {
    mihomoConfigCache.invalidateRuntimeConfigCache()
  }
  mihomoConfigCache.clearInFlightRequests(C.getRuntimeConfig, C.mihomoGroups)
}

export async function getRuntimeConfigStr(): Promise<string> {
  if (isTauriHost()) {
    const cachedRuntimeConfigStr = mihomoConfigCache.getRuntimeConfigStr()
    if (cachedRuntimeConfigStr) {
      return cachedRuntimeConfigStr
    }

    if (mihomoConfigCache.tauriRuntimeConfigStrPromise) {
      return mihomoConfigCache.tauriRuntimeConfigStrPromise
    }

    const requestRevision = mihomoConfigCache.tauriRuntimeConfigRevision
    const request = invokeSafe<string>(C.getRuntimeConfigStr)
      .then((configStr) => {
        if (requestRevision === mihomoConfigCache.tauriRuntimeConfigRevision) {
          mihomoConfigCache.setRuntimeConfigStr(configStr)
        }

        return mihomoConfigCache.getRuntimeConfigStr() || configStr
      })
      .catch(() => {
        const fallback = JSON.stringify(createTauriRuntimeConfigWrapper(), null, 2)

        if (requestRevision === mihomoConfigCache.tauriRuntimeConfigRevision) {
          mihomoConfigCache.setRuntimeConfigStr(fallback)
        }

        return mihomoConfigCache.getRuntimeConfigStr() || fallback
      })
      .finally(() => {
        if (mihomoConfigCache.tauriRuntimeConfigStrPromise === request) {
          mihomoConfigCache.tauriRuntimeConfigStrPromise = null
        }
      })

    mihomoConfigCache.tauriRuntimeConfigStrPromise = request
    return request
  }

  return invokeSafe(C.getRuntimeConfigStr)
}

export async function mihomoCloseAllConnections(name?: string): Promise<void> {
  return invokeSafe(C.mihomoCloseAllConnections, name)
}

export async function triggerSysProxy(enable: boolean, onlyActiveDevice: boolean): Promise<void> {
  return invokeSafe(C.triggerSysProxy, enable, onlyActiveDevice)
}

export async function mihomoDnsQuery(
  name: string,
  type: string
): Promise<{ Answer?: { data: string }[] }> {
  return invokeSafe(C.mihomoDnsQuery, name, type)
}

export async function mihomoUpgradeGeo(): Promise<void> {
  return invokeSafe(C.mihomoUpgradeGeo)
}

export async function mihomoUpgradeGeoFile(
  file: 'geoip' | 'geosite' | 'mmdb' | 'asn',
  url: string
): Promise<void> {
  return invokeSafe(C.mihomoUpgradeGeoFile, file, url)
}

export async function mihomoUpgradeUI(): Promise<void> {
  return invokeSafe(C.mihomoUpgradeUI)
}

export async function mihomoUpgrade(): Promise<void> {
  return invokeSafe(C.mihomoUpgrade)
}

export async function restartMihomoConnections(): Promise<void> {
  if (isTauriHost()) {
    startTauriMihomoEventBridge()
    return
  }

  return invokeSafe(C.restartMihomoConnections)
}

export async function setupFirewall(): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.setupFirewall)
  }

  return invokeSafe(C.setupFirewall)
}

export async function getInterfaces(): Promise<Record<string, NetworkInterfaceInfo[]>> {
  return invokeSafe(C.getInterfaces)
}

export async function startNetworkDetection(): Promise<void> {
  return invokeSafe(C.startNetworkDetection)
}

export async function stopNetworkDetection(): Promise<void> {
  return invokeSafe(C.stopNetworkDetection)
}

mihomoSocketManager.installTauriBridgeLifecycle()
