import { C, invokeSafe } from './ipc-core'
import { desktop, emitDesktopEvent } from '@renderer/api/desktop'
import { IPC_ON_CHANNELS } from '../../../shared/ipc'
import { createDefaultControledMihomoConfig } from '../../../shared/defaults/runtime'
import { ON, onIpc } from './ipc-channels'

const tauriSockets: Partial<Record<'traffic' | 'memory' | 'logs' | 'connections', WebSocket>> = {}
let tauriSocketRetryTimer: number | null = null
let tauriControlledConfigCache: Partial<MihomoConfig> | null = null
let tauriRuntimeConfigCache: MihomoConfig | null = null
let tauriRuntimeConfigStrCache: string | null = null
let tauriRuntimeConfigPromise: Promise<MihomoConfig> | null = null
let tauriRuntimeConfigStrPromise: Promise<string> | null = null
let tauriControllerUrl: string | null = null
let tauriControllerUrlPromise: Promise<string | null> | null = null
let tauriBridgeLifecycleInstalled = false
const latestVersionCache = new Map<boolean, { value: string | null; at: number }>()
const latestVersionPromiseCache = new Map<boolean, Promise<string | null>>()
const TAURI_TRAFFIC_EVENT = 'routex:tauri-traffic'
const MIN_TAURI_CONNECTION_INTERVAL = 250
let tauriRuntimeConfigRevision = 0

const CHECK_LATEST_VERSION_CACHE_MS = 3 * 60 * 1000

function isTauriHost(): boolean {
  return __ROUTEX_HOST__ === 'tauri'
}

function getDefaultTauriControledMihomoConfig(): Partial<MihomoConfig> {
  return createDefaultControledMihomoConfig(__ROUTEX_PLATFORM__)
}

function readTauriControledMihomoConfig(): Partial<MihomoConfig> {
  return {
    ...getDefaultTauriControledMihomoConfig(),
    ...(tauriControlledConfigCache || {})
  }
}

function readTauriControllerUrl(): string | null {
  return tauriControllerUrl
}

function writeTauriControllerUrl(url: string): void {
  tauriControllerUrl = url
}

async function readTauriConnectionIntervalMs(): Promise<number> {
  try {
    const appConfig = await invokeSafe<Partial<AppConfig>>(C.getAppConfig)
    const rawInterval = Number.parseInt(String(appConfig.connectionInterval ?? MIN_TAURI_CONNECTION_INTERVAL), 10)

    if (!Number.isFinite(rawInterval)) {
      return MIN_TAURI_CONNECTION_INTERVAL
    }

    return Math.max(MIN_TAURI_CONNECTION_INTERVAL, rawInterval)
  } catch {
    return MIN_TAURI_CONNECTION_INTERVAL
  }
}

async function ensureTauriControllerUrl(): Promise<string | null> {
  const existing = readTauriControllerUrl()
  if (existing) {
    return existing
  }

  if (!tauriControllerUrlPromise) {
    tauriControllerUrlPromise = invokeSafe<string | null>(C.getControllerUrl)
      .then((controllerUrl) => {
        if (!controllerUrl) {
          return null
        }

        writeTauriControllerUrl(controllerUrl)
        return controllerUrl
      })
      .catch(() => null)
      .finally(() => {
        tauriControllerUrlPromise = null
      })
  }

  return tauriControllerUrlPromise
}

function invalidateTauriRuntimeConfigCache(): void {
  tauriRuntimeConfigCache = null
  tauriRuntimeConfigStrCache = null
  tauriRuntimeConfigPromise = null
  tauriRuntimeConfigStrPromise = null
  tauriRuntimeConfigRevision += 1
}

function closeTauriSocket(key: keyof typeof tauriSockets): void {
  const socket = tauriSockets[key]
  if (!socket) return
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
  socket.close()
  delete tauriSockets[key]
}

export function stopTauriMihomoEventBridge(): void {
  closeTauriSocket('traffic')
  closeTauriSocket('memory')
  closeTauriSocket('logs')
  closeTauriSocket('connections')

  if (tauriSocketRetryTimer !== null) {
    window.clearTimeout(tauriSocketRetryTimer)
    tauriSocketRetryTimer = null
  }
}

function installTauriBridgeLifecycle(): void {
  if (!isTauriHost() || tauriBridgeLifecycleInstalled) {
    return
  }

  tauriBridgeLifecycleInstalled = true

  desktop.on<[unknown]>(IPC_ON_CHANNELS.coreStarted, (_event, payload) => {
    invalidateTauriRuntimeConfigCache()
    if (
      payload &&
      typeof payload === 'object' &&
      'controller' in (payload as Record<string, unknown>) &&
      typeof (payload as Record<string, unknown>).controller === 'string'
    ) {
      writeTauriControllerUrl(`http://${(payload as { controller: string }).controller}`)
      startTauriMihomoEventBridge()
    }
  })

  desktop.on(IPC_ON_CHANNELS.controledMihomoConfigUpdated, () => {
    invalidateTauriRuntimeConfigCache()
    startTauriMihomoEventBridge()
  })

  desktop.on(IPC_ON_CHANNELS.appConfigUpdated, () => {
    startTauriMihomoEventBridge()
  })

  desktop.on(IPC_ON_CHANNELS.profileConfigUpdated, () => {
    invalidateTauriRuntimeConfigCache()
  })

  desktop.on(IPC_ON_CHANNELS.overrideConfigUpdated, () => {
    invalidateTauriRuntimeConfigCache()
  })

  desktop.on(IPC_ON_CHANNELS.rulesUpdated, () => {
    invalidateTauriRuntimeConfigCache()
  })
}

function scheduleTauriBridgeReconnect(): void {
  if (tauriSocketRetryTimer !== null) {
    return
  }

  tauriSocketRetryTimer = window.setTimeout(() => {
    tauriSocketRetryTimer = null
    startTauriMihomoEventBridge()
  }, 1200)
}

function emitParsedDesktopEvent<T>(channel: (typeof IPC_ON_CHANNELS)[keyof typeof IPC_ON_CHANNELS], payload: string): void {
  try {
    emitDesktopEvent(channel, JSON.parse(payload) as T)
  } catch {
    // ignore malformed payload
  }
}

function emitTauriTrafficEvent(payload: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent(TAURI_TRAFFIC_EVENT, {
        detail: JSON.parse(payload) as ControllerTraffic
      })
    )
  } catch {
    // ignore malformed payload
  }
}

function toWebSocketUrl(controllerUrl: string, path: string): string {
  return controllerUrl.replace(/^http/i, 'ws') + path
}

function startTauriSocket(
  key: keyof typeof tauriSockets,
  url: string,
  onMessage: (payload: string) => void
): void {
  closeTauriSocket(key)

  try {
    const socket = new WebSocket(url)
    tauriSockets[key] = socket
    const handleDisconnect = () => {
      closeTauriSocket(key)
      scheduleTauriBridgeReconnect()
    }
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        onMessage(event.data)
      }
    }
    socket.onerror = handleDisconnect
    socket.onclose = handleDisconnect
  } catch {
    scheduleTauriBridgeReconnect()
  }
}

export function startTauriMihomoEventBridge(): void {
  if (!isTauriHost()) {
    return
  }

  const controllerUrl = readTauriControllerUrl()
  if (!controllerUrl) {
    void ensureTauriControllerUrl().then((resolvedControllerUrl) => {
      if (resolvedControllerUrl) {
        startTauriMihomoEventBridge()
        return
      }

      scheduleTauriBridgeReconnect()
    })
    return
  }

  const { 'log-level': logLevel = 'info' } = readTauriControledMihomoConfig()

  startTauriSocket('traffic', toWebSocketUrl(controllerUrl, '/traffic'), emitTauriTrafficEvent)

  startTauriSocket('memory', toWebSocketUrl(controllerUrl, '/memory'), (payload) => {
    // 窗口不可见时跳过内存消息
    if (document.hidden) return
    emitParsedDesktopEvent<ControllerMemory>(IPC_ON_CHANNELS.mihomoMemory, payload)
  })

  startTauriSocket('logs', toWebSocketUrl(controllerUrl, `/logs?level=${logLevel}`), (payload) => {
    // 窗口不可见时跳过日志消息
    if (document.hidden) return
    emitParsedDesktopEvent<ControllerLog>(IPC_ON_CHANNELS.mihomoLogs, payload)
  })

  void readTauriConnectionIntervalMs().then((connectionInterval) => {
    startTauriSocket(
      'connections',
      toWebSocketUrl(controllerUrl, `/connections?interval=${connectionInterval}`),
      (payload) => {
        emitParsedDesktopEvent<ControllerConnections>(IPC_ON_CHANNELS.mihomoConnections, payload)
      }
    )
  })
}

export function onTauriRealtimeTraffic(listener: (info: ControllerTraffic) => void): () => void {
  if (!isTauriHost()) {
    return () => undefined
  }

  const handleTraffic = (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return
    }

    listener(event.detail as ControllerTraffic)
  }

  window.addEventListener(TAURI_TRAFFIC_EVENT, handleTraffic)
  return () => {
    window.removeEventListener(TAURI_TRAFFIC_EVENT, handleTraffic)
  }
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

function createTauriRuntimeConfig(input?: Partial<MihomoConfig>): MihomoConfig {
  const fallback = createDefaultControledMihomoConfig(__ROUTEX_PLATFORM__)
  const config = {
    ...readTauriControledMihomoConfig(),
    ...(input || {})
  }

  return {
    ...fallback,
    ...config,
    authentication: config.authentication ?? fallback.authentication ?? [],
    tun: {
      ...fallback.tun,
      ...config.tun
    },
    dns: {
      ...fallback.dns,
      ...config.dns
    },
    sniffer: {
      ...fallback.sniffer,
      ...config.sniffer
    },
    profile: {
      ...fallback.profile,
      ...config.profile
    },
    'proxy-providers': config['proxy-providers'] ?? fallback['proxy-providers'] ?? {},
    'rule-providers': config['rule-providers'] ?? fallback['rule-providers'] ?? {},
    proxies: config.proxies ?? fallback.proxies ?? [],
    'proxy-groups': config['proxy-groups'] ?? fallback['proxy-groups'] ?? [],
    rules: config.rules ?? fallback.rules ?? []
  } as MihomoConfig
}

type RuntimeNode = Record<string, unknown>

function getRuntimeProxyEntries(runtime: MihomoConfig): RuntimeNode[] {
  return Array.isArray(runtime.proxies) ? (runtime.proxies as RuntimeNode[]) : []
}

function getRuntimeGroupEntries(runtime: MihomoConfig): RuntimeNode[] {
  return Array.isArray(runtime['proxy-groups']) ? (runtime['proxy-groups'] as RuntimeNode[]) : []
}

function toProxyNameList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function createRuntimeProxyDetail(proxy: RuntimeNode): ControllerProxiesDetail | null {
  const name = typeof proxy.name === 'string' ? proxy.name : ''
  if (!name) {
    return null
  }

  return {
    alive: false,
    extra: {},
    history: [],
    id: name,
    name,
    tfo: false,
    type: (typeof proxy.type === 'string' ? proxy.type : 'Unknown') as MihomoProxyType,
    udp: Boolean(proxy.udp),
    xudp: Boolean(proxy.xudp),
    'dialer-proxy': '',
    interface: '',
    mptcp: false,
    'routing-mark': 0,
    smux: false,
    uot: false,
    icon: typeof proxy.icon === 'string' ? proxy.icon : undefined
  }
}

function createRuntimeGroupShell(group: RuntimeNode): ControllerGroupDetail | null {
  const name = typeof group.name === 'string' ? group.name : ''
  if (!name) {
    return null
  }

  const members = toProxyNameList(group.all ?? group.proxies)
  return {
    alive: false,
    all: members,
    extra: {},
    hidden: Boolean(group.hidden),
    history: [],
    icon: typeof group.icon === 'string' ? group.icon : '',
    interface: '',
    mptcp: false,
    name,
    now: '',
    smux: false,
    testUrl: typeof group.url === 'string' ? group.url : undefined,
    tfo: false,
    type: (typeof group.type === 'string' ? group.type : 'Selector') as MihomoProxyType,
    udp: true,
    uot: false,
    xudp: false,
    expectedStatus: typeof group.expectedStatus === 'string' ? group.expectedStatus : undefined,
    fixed: typeof group.fixed === 'string' ? group.fixed : undefined
  }
}

function buildRuntimeGroupsFallback(runtime: MihomoConfig): ControllerMixedGroup[] {
  const proxyEntries = getRuntimeProxyEntries(runtime)
  const groupEntries = getRuntimeGroupEntries(runtime)
  const entityMap = new Map<string, ControllerProxiesDetail | ControllerGroupDetail>()

  proxyEntries.forEach((proxy) => {
    const detail = createRuntimeProxyDetail(proxy)
    if (detail) {
      entityMap.set(detail.name, detail)
    }
  })

  const groupShells = new Map<string, ControllerGroupDetail>()
  groupEntries.forEach((group) => {
    const shell = createRuntimeGroupShell(group)
    if (shell) {
      groupShells.set(shell.name, shell)
      entityMap.set(shell.name, shell)
    }
  })

  return groupEntries.reduce<ControllerMixedGroup[]>((acc, group) => {
    const name = typeof group.name === 'string' ? group.name : ''
    if (!name) {
      return acc
    }

    const shell = groupShells.get(name)
    if (!shell || shell.hidden) {
      return acc
    }

    const explicitMembers = toProxyNameList(group.all ?? group.proxies)
    const members =
      explicitMembers.length > 0
        ? explicitMembers
        : group['include-all'] === true
          ? proxyEntries
              .map((proxy) => (typeof proxy.name === 'string' ? proxy.name : ''))
              .filter((proxyName) => proxyName.length > 0)
          : []

    const resolvedMembers = members
      .map((memberName) => entityMap.get(memberName))
      .filter((member): member is ControllerProxiesDetail | ControllerGroupDetail => Boolean(member))

    const now =
      typeof group.now === 'string'
        ? group.now
        : typeof shell.fixed === 'string'
          ? shell.fixed
          : resolvedMembers[0]?.name || ''

    acc.push({
      ...shell,
      now,
      all: resolvedMembers
    })

    return acc
  }, [])
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
  return invokeSafe(C.mihomoRules)
}

export async function mihomoProxies(): Promise<ControllerProxies> {
  return invokeSafe(C.mihomoProxies)
}

export async function mihomoConnections(): Promise<ControllerConnections> {
  return invokeSafe(C.mihomoConnections)
}

export async function mihomoGroups(): Promise<ControllerMixedGroup[]> {
  return invokeSafe(C.mihomoGroups)
}

export async function mihomoCloseConnection(id: string): Promise<void> {
  return invokeSafe(C.mihomoCloseConnection, id)
}

export async function mihomoRuleProviders(): Promise<ControllerRuleProviders> {
  return invokeSafe(C.mihomoRuleProviders)
}

export async function mihomoProxyProviders(): Promise<ControllerProxyProviders> {
  return invokeSafe(C.mihomoProxyProviders)
}

export async function mihomoChangeProxy(
  group: string,
  proxy: string
): Promise<ControllerProxiesDetail> {
  return invokeSafe<ControllerProxiesDetail>(C.mihomoChangeProxy, group, proxy)
}

export async function mihomoUnfixedProxy(group: string): Promise<ControllerProxiesDetail> {
  return invokeSafe(C.mihomoUnfixedProxy, group)
}

export async function mihomoGroupDelay(
  group: string,
  url?: string
): Promise<ControllerGroupDelay> {
  return invokeSafe(C.mihomoGroupDelay, group, url)
}

export async function getRuntimeConfig(): Promise<MihomoConfig> {
  if (isTauriHost()) {
    if (tauriRuntimeConfigCache) {
      return tauriRuntimeConfigCache
    }

    if (tauriRuntimeConfigPromise) {
      return tauriRuntimeConfigPromise
    }

    const requestRevision = tauriRuntimeConfigRevision
    const request = invokeSafe<Partial<MihomoConfig>>(C.getRuntimeConfig)
      .then((config) => {
        tauriControlledConfigCache = { ...tauriControlledConfigCache, ...config }
        const normalized = createTauriRuntimeConfig(config)

        if (requestRevision === tauriRuntimeConfigRevision) {
          tauriRuntimeConfigCache = normalized
        }

        return tauriRuntimeConfigCache || normalized
      })
      .catch(() => {
        const fallback = createTauriRuntimeConfig()

        if (requestRevision === tauriRuntimeConfigRevision) {
          tauriRuntimeConfigCache = fallback
        }

        return tauriRuntimeConfigCache || fallback
      })
      .finally(() => {
        if (tauriRuntimeConfigPromise === request) {
          tauriRuntimeConfigPromise = null
        }
      })

    tauriRuntimeConfigPromise = request
    return request
  }

  return invokeSafe(C.getRuntimeConfig)
}

export async function restartCore(): Promise<void> {
  if (isTauriHost()) {
    const result = (await invokeSafe(C.restartCore)) as
      | { controller?: string }
      | undefined
    if (result?.controller) {
      writeTauriControllerUrl(`http://${result.controller}`)
      startTauriMihomoEventBridge()
    }
    return
  }

  return invokeSafe(C.restartCore)
}

export async function mihomoUpdateProxyProviders(name: string): Promise<void> {
  return invokeSafe(C.mihomoUpdateProxyProviders, name)
}

export async function mihomoUpdateRuleProviders(name: string): Promise<void> {
  return invokeSafe(C.mihomoUpdateRuleProviders, name)
}

export async function mihomoProxyDelay(
  proxy: string,
  url?: string
): Promise<ControllerProxiesDelay> {
  return invokeSafe(C.mihomoProxyDelay, proxy, url)
}

export async function mihomoToggleRuleDisabled(data: Record<number, boolean>): Promise<void> {
  return invokeSafe(C.mihomoToggleRuleDisabled, data)
}

export async function checkMihomoLatestVersion(isAlpha: boolean): Promise<string | null> {
  const cached = latestVersionCache.get(isAlpha)
  if (cached && Date.now() - cached.at < CHECK_LATEST_VERSION_CACHE_MS) {
    return cached.value
  }

  const pending = latestVersionPromiseCache.get(isAlpha)
  if (pending) {
    return pending
  }

  const request = invokeSafe<string | null>(C.checkMihomoLatestVersion, isAlpha)
    .then((result) => {
      latestVersionCache.set(isAlpha, { value: result, at: Date.now() })
      return result
    })
    .finally(() => {
      latestVersionPromiseCache.delete(isAlpha)
    })

  latestVersionPromiseCache.set(isAlpha, request)
  return request
}

export async function getControledMihomoConfig(force = false): Promise<Partial<MihomoConfig>> {
  if (isTauriHost()) {
    const config = await invokeSafe<Partial<MihomoConfig>>(C.getControledMihomoConfig, force)
    tauriControlledConfigCache = config
    return readTauriControledMihomoConfig()
  }

  return invokeSafe(C.getControledMihomoConfig, force)
}

export async function patchControledMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  if (isTauriHost()) {
    await invokeSafe(C.patchControledMihomoConfig, patch)
    tauriControlledConfigCache = {
      ...readTauriControledMihomoConfig(),
      ...patch
    }
    invalidateTauriRuntimeConfigCache()
    return
  }

  return invokeSafe(C.patchControledMihomoConfig, patch)
}

export async function patchMihomoConfig(patch: Partial<MihomoConfig>): Promise<void> {
  if (isTauriHost()) {
    return invokeSafe(C.patchMihomoConfig, patch)
  }

  return invokeSafe(C.patchMihomoConfig, patch)
}

export async function getRuntimeConfigStr(): Promise<string> {
  if (isTauriHost()) {
    if (tauriRuntimeConfigStrCache) {
      return tauriRuntimeConfigStrCache
    }

    if (tauriRuntimeConfigStrPromise) {
      return tauriRuntimeConfigStrPromise
    }

    const requestRevision = tauriRuntimeConfigRevision
    const request = invokeSafe<string>(C.getRuntimeConfigStr)
      .then((configStr) => {
        if (requestRevision === tauriRuntimeConfigRevision) {
          tauriRuntimeConfigStrCache = configStr
        }

        return tauriRuntimeConfigStrCache || configStr
      })
      .catch(() => {
        const fallback = JSON.stringify(createTauriRuntimeConfig(), null, 2)

        if (requestRevision === tauriRuntimeConfigRevision) {
          tauriRuntimeConfigStrCache = fallback
        }

        return tauriRuntimeConfigStrCache || fallback
      })
      .finally(() => {
        if (tauriRuntimeConfigStrPromise === request) {
          tauriRuntimeConfigStrPromise = null
        }
      })

    tauriRuntimeConfigStrPromise = request
    return request
  }

  return invokeSafe(C.getRuntimeConfigStr)
}

export async function mihomoCloseAllConnections(name?: string): Promise<void> {
  return invokeSafe(C.mihomoCloseAllConnections, name)
}

export async function triggerSysProxy(
  enable: boolean,
  onlyActiveDevice: boolean
): Promise<void> {
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

installTauriBridgeLifecycle()
