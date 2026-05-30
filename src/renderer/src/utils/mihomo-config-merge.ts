import { createDefaultControledMihomoConfig } from '../../../shared/defaults/runtime'

type RuntimeNode = Record<string, unknown>

export function createTauriRuntimeConfig(
  input: Partial<MihomoConfig> | undefined,
  controlledConfigCache: Partial<MihomoConfig>,
  platform: NodeJS.Platform
): MihomoConfig {
  const fallback = createDefaultControledMihomoConfig(platform)
  const config = {
    ...controlledConfigCache,
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

export function buildRuntimeGroupsFallback(runtime: MihomoConfig): ControllerMixedGroup[] {
  const proxyEntries = Array.isArray(runtime.proxies) ? (runtime.proxies as RuntimeNode[]) : []
  const groupEntries = Array.isArray(runtime['proxy-groups'])
    ? (runtime['proxy-groups'] as RuntimeNode[])
    : []

  const entityMap = new Map<string, ControllerProxiesDetail | ControllerGroupDetail>()
  const groupShells = new Map<string, ControllerGroupDetail>()

  for (const proxy of proxyEntries) {
    const detail = createRuntimeProxyDetail(proxy)
    if (detail) entityMap.set(detail.name, detail)
  }

  for (const group of groupEntries) {
    const shell = createRuntimeGroupShell(group)
    if (shell) {
      groupShells.set(shell.name, shell)
      entityMap.set(shell.name, shell)
    }
  }

  return groupEntries.reduce<ControllerMixedGroup[]>((acc, group) => {
    const name = typeof group.name === 'string' ? group.name : ''
    const shell = groupShells.get(name)
    if (!name || !shell || shell.hidden) return acc

    const explicitMembers = toProxyNameList(group.all ?? group.proxies)
    const members =
      explicitMembers.length > 0
        ? explicitMembers
        : group['include-all']
          ? proxyEntries.map((p) => (typeof p.name === 'string' ? p.name : '')).filter(Boolean)
          : []

    const resolvedMembers = members
      .map((m) => entityMap.get(m))
      .filter((m): m is ControllerProxiesDetail | ControllerGroupDetail => Boolean(m))

    const now =
      typeof group.now === 'string'
        ? group.now
        : typeof shell.fixed === 'string'
          ? shell.fixed
          : resolvedMembers[0]?.name || ''

    acc.push({ ...shell, now, all: resolvedMembers })
    return acc
  }, [])
}
