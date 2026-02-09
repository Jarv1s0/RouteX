import {
  getControledMihomoConfig,
  getProfileConfig,
  getProfile,
  getProfileStr,
  getProfileItem,
  getOverride,
  getOverrideItem,
  getOverrideConfig,
  getAppConfig,
  getChainsConfig
} from '../config'
import {
  mihomoProfileWorkDir,
  mihomoWorkConfigPath,
  mihomoWorkDir,
  overridePath
} from '../utils/dirs'
import { parseYaml, stringifyYaml } from '../utils/yaml'
import { copyFile, mkdir, writeFile, rm, stat } from 'fs/promises'
import { deepMerge } from '../utils/merge'
import vm from 'vm'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'

let runtimeConfigStr: string,
  rawProfileStr: string,
  currentProfileStr: string,
  overrideProfileStr: string,
  runtimeConfig: MihomoConfig

export async function generateProfile(): Promise<void> {
  const { current } = await getProfileConfig()
  const { diffWorkDir = false, controlDns = true, controlSniff = true } = await getAppConfig()
  const currentProfileConfig = await getProfile(current)
  rawProfileStr = await getProfileStr(current)
  currentProfileStr = stringifyYaml(currentProfileConfig)
  const currentProfile = await overrideProfile(current, currentProfileConfig)
  overrideProfileStr = stringifyYaml(currentProfile)
  const controledMihomoConfig = await getControledMihomoConfig()

  const configToMerge = JSON.parse(JSON.stringify(controledMihomoConfig))
  if (!controlDns) {
    delete configToMerge.dns
    delete configToMerge.hosts
  }
  if (!controlSniff) {
    delete configToMerge.sniffer
  }

  const profile = deepMerge(JSON.parse(JSON.stringify(currentProfile)), configToMerge)

  // 注入代理链虚拟节点 (安全包装，防止影响正常配置生成)
  try {
    await injectChainProxies(profile)
  } catch (e) {
    // ignore
  }

  await cleanProfile(profile, controlDns, controlSniff)

  runtimeConfig = profile
  runtimeConfigStr = stringifyYaml(profile)
  if (diffWorkDir) {
    await prepareProfileWorkDir(current)
  }
  await writeFile(
    diffWorkDir ? mihomoWorkConfigPath(current) : mihomoWorkConfigPath('work'),
    runtimeConfigStr
  )
}

/**
 * 注入代理链虚拟节点
 * 根据 chains.yaml 配置生成虚拟节点并加入到指定策略组
 * 
 * 实现原理：
 * 1. 克隆落地节点的配置
 * 2. 设置 dialer-proxy 为前置节点/组（只支持单级）
 * 3. 将虚拟节点添加到 proxies 列表
 * 4. 可选：将虚拟节点添加到指定策略组
 */
async function injectChainProxies(profile: MihomoConfig): Promise<void> {
  // Force reload chains config to ensure we get the latest updates from disk
  // regardless of memory cache state in other modules
  const chainsConfig = await getChainsConfig(true)
  if (!chainsConfig.items || chainsConfig.items.length === 0) {
    return
  }

  // 确保 proxies 和 proxy-groups 存在
  if (!Array.isArray(profile.proxies)) {
    profile.proxies = []
  }
  if (!Array.isArray(profile['proxy-groups'])) {
    profile['proxy-groups'] = []
  }

  const proxies = profile.proxies as Record<string, unknown>[]
  const proxyGroups = profile['proxy-groups'] as Record<string, unknown>[]

  // --- 环路检测 (Loop Detection) ---
  const dependencyGraph = new Map<string, Set<string>>()
  
  // 1. 添加现有的策略组依赖 (Group -> Proxy)
  for (const group of proxyGroups) {
    const name = group.name as string
    if (!name) continue
    if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set())
    
    if (Array.isArray(group.proxies)) {
      group.proxies.forEach((p: string) => dependencyGraph.get(name)?.add(p))
    }
  }

  // 1.5 添加普通代理的 dialer-proxy 依赖 (Proxy -> Dialer)
  if (Array.isArray(proxies)) {
    for (const p of proxies) {
      const name = p.name as string
      const dialer = p['dialer-proxy'] as string
      if (name && dialer) {
        if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set())
        dependencyGraph.get(name)?.add(dialer)
      }
    }
  }

  // 2. 筛选活跃的代理链并构建初始依赖 (Chain -> Dependencies)
  const activeChains = chainsConfig.items.filter(
    (c) => c.enabled !== false && c.name && c.targetProxy && c.dialerProxy
  )

  // --- 0. 预处理：全局隔离 (Global Chain Isolation) ---
  // 用户要求：所有代理链都不应被自动筛选规则（filter）命中进入策略组。
  // 必须通过 targetGroups 显式指定才能进入。
  // 因此，我们将所有活跃代理链的名称添加到所有带 filter 的策略组的 exclude-filter 中。
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  if (activeChains.length > 0) {
    const chainNames = activeChains.map((c) => escapeRegExp(c.name)).join('|')

    for (const group of proxyGroups) {
      // 只有带 filter 的组才需要处理排除逻辑 (url-test, select, fallback 等都可能带 filter)
      if (group.filter || (group as any)._filter) { // 兼容性检查，通常只有 filter 字段
        const currentExclude = (group['exclude-filter'] as string) || ''
        
        // 直接拼接名称，不使用锚点 (^$)，以提高兼容性防止正则引擎解析异常
        // 虽然可能导致部分匹配（如 'Chain' 也会排除 'Chain2'），但鉴于代理链名称通常独特且为了解决 Core 问题，这是安全折中
        if (!currentExclude) {
            group['exclude-filter'] = chainNames
        } else { // 简单防重检查：如果已经包含了其中任何一个名字，就不加了？不，必须全加。
            // 为简单起见，直接拼接。Clash 会处理形如 "A|B|A" 这样的重复正则吗？会的。
            // 但为了避免字符串无限增长（虽然每次 generateProfile 都是新的 profile 对象），还是做个简单检查
            // 只要 exclude-filter 字符串里不包含 chainNames (作为整体) 就拼接
            // 注意：这里无法完美去重，但对于 "生成一次性 config" 场景，重复拼接不影响逻辑
             group['exclude-filter'] = `${currentExclude}|${chainNames}`
        }
      }
    }
  }

  for (const chain of activeChains) {
    const { name, dialerProxy } = chain
    
    if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set())
    
    // Chain -> Dialer (强路由依赖)
    dependencyGraph.get(name)?.add(dialerProxy)
    // Chain -> Target (配置依赖)
    dependencyGraph.get(name)?.add(chain.targetProxy)
  }

  // BFS 可达性检测
  const canReach = (start: string, end: string, graph: Map<string, Set<string>>): boolean => {
    if (start === end) return true
    const queue = [start]
    const visited = new Set<string>([start])
    
    while (queue.length > 0) {
      const node = queue.shift()!
      if (node === end) return true
      
      const neighbors = graph.get(node)
      if (neighbors) {
        for (const next of neighbors) {
          if (!visited.has(next)) {
            visited.add(next)
            queue.push(next)
          }
        }
      }
    }
    return false
  }

  // 3. 安全注入检查
  const safeChains: typeof activeChains = []

  for (const chain of activeChains) {
    // 3.1 核心自环检查
    let isSelfLoop = false
    const neighbors = dependencyGraph.get(chain.name)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (canReach(neighbor, chain.name, dependencyGraph)) {
          isSelfLoop = true
          break
        }
      }
    }
    
    if (isSelfLoop) {
      console.error(`[Factory] Structural loop detected for chain "${chain.name}", skipping.`)
      continue
    }

    // 3.2 策略组环路规避 (Group Membership Check)
    if (chain.targetGroups && Array.isArray(chain.targetGroups)) {
      const safeTargetGroups: string[] = []
      
      for (const groupName of chain.targetGroups) {
        if (canReach(chain.name, groupName, dependencyGraph)) {
           console.warn(`[Factory] Loop prevention: Skipping add chain "${chain.name}" to group "${groupName}".`)
        } else {
           safeTargetGroups.push(groupName)
           if (!dependencyGraph.has(groupName)) dependencyGraph.set(groupName, new Set())
           dependencyGraph.get(groupName)?.add(chain.name)
        }
      }
      chain.targetGroups = safeTargetGroups
    }
    
    safeChains.push(chain)
  }

  // --- 执行安全的注入 ---
  for (const chain of safeChains) {
    // 查找落地节点配置
    const targetProxyConfig = proxies.find((p) => p.name === chain.targetProxy)
    if (!targetProxyConfig) {
      continue
    }

    // 简单检查 targets
    const targetExists =
      (profile.proxies as any[])?.some((p) => p.name === chain.targetProxy) ||
      (profile['proxy-groups'] as any[])?.some((g) => g.name === chain.targetProxy)

    // 落地节点必须存在
    if (!targetExists) {
      continue
    }

    // 检查 dialer-proxy 是否存在
    const dialerExists =
      ['DIRECT', 'REJECT', 'COMPATIBLE'].includes(chain.dialerProxy) ||
      (profile.proxies as any[])?.some((p) => p.name === chain.dialerProxy) ||
      (profile['proxy-groups'] as any[])?.some((g) => g.name === chain.dialerProxy)

    if (!dialerExists) {
      console.warn(
        `[Factory] Dialer proxy "${chain.dialerProxy}" not found for chain "${chain.name}", skipping injection.`
      )
      continue
    }

    // 检查是否已存在同名代理链节点（覆盖更新）
    const existingIndex = proxies.findIndex((p) => p.name === chain.name)
    if (existingIndex !== -1) {
      proxies.splice(existingIndex, 1)
    }

    // 克隆落地节点，创建代理链虚拟节点
    const chainProxy = JSON.parse(JSON.stringify(targetProxyConfig)) as Record<string, unknown>
    chainProxy.name = chain.name

    // 设置 dialer-proxy 为前置节点/组
    chainProxy['dialer-proxy'] = chain.dialerProxy

    // 添加到 proxies 列表
    proxies.push(chainProxy)

    // 加入策略组 (支持多选)
    if (chain.targetGroups && Array.isArray(chain.targetGroups)) {
      chain.targetGroups.forEach((groupName) => {
        const targetGroupIndex = proxyGroups.findIndex((g) => g.name === groupName)
        if (targetGroupIndex !== -1) {
          const targetGroup = proxyGroups[targetGroupIndex]
          // 确保 proxies 数组存在
          if (!Array.isArray(targetGroup.proxies)) {
            targetGroup.proxies = []
          }
          const groupProxies = targetGroup.proxies as string[]
          if (!groupProxies.includes(chain.name)) {
            groupProxies.push(chain.name)
          }
        }
      })
    }
  }
}

async function cleanProfile(
  profile: MihomoConfig,
  controlDns: boolean,
  controlSniff: boolean
): Promise<void> {
  if (!['info', 'debug'].includes(profile['log-level'])) {
    profile['log-level'] = 'info'
  }

  configureLanSettings(profile)
  cleanBooleanConfigs(profile)
  cleanNumberConfigs(profile)
  cleanStringConfigs(profile)
  cleanAuthenticationConfig(profile)
  cleanTunConfig(profile)
  cleanDnsConfig(profile, controlDns)
  cleanSnifferConfig(profile, controlSniff)
  cleanProxyConfigs(profile)
}

function cleanBooleanConfigs(profile: MihomoConfig): void {
  if (profile.ipv6 !== false) {
    delete (profile as Partial<MihomoConfig>).ipv6
  }

  const booleanConfigs = [
    'unified-delay',
    'tcp-concurrent',
    'geodata-mode',
    'geo-auto-update',
    'disable-keep-alive'
  ]

  booleanConfigs.forEach((key) => {
    if (!profile[key]) delete (profile as Partial<MihomoConfig>)[key]
  })

  if (!profile.profile) return

  const { 'store-selected': hasStoreSelected, 'store-fake-ip': hasStoreFakeIp } = profile.profile

  if (!hasStoreSelected && !hasStoreFakeIp) {
    delete (profile as Partial<MihomoConfig>).profile
  } else {
    const profileConfig = profile.profile as MihomoProfileConfig
    if (!hasStoreSelected) delete profileConfig['store-selected']
    if (!hasStoreFakeIp) delete profileConfig['store-fake-ip']
  }
}

function cleanNumberConfigs(profile: MihomoConfig): void {
  ;[
    'port',
    'socks-port',
    'redir-port',
    'tproxy-port',
    'mixed-port',
    'keep-alive-idle',
    'keep-alive-interval'
  ].forEach((key) => {
    if (profile[key] === 0) delete (profile as Partial<MihomoConfig>)[key]
  })
}

function cleanStringConfigs(profile: MihomoConfig): void {
  const partialProfile = profile as Partial<MihomoConfig>

  if (profile.mode === 'rule') delete partialProfile.mode

  const emptyStringConfigs = ['interface-name', 'secret']
  emptyStringConfigs.forEach((key) => {
    if (profile[key] === '') delete partialProfile[key]
  })

  if (profile['external-controller'] === '') {
    delete partialProfile['external-controller']
    delete partialProfile['external-ui']
    delete partialProfile['external-ui-url']
    delete partialProfile['external-controller-cors']
  } else if (profile['external-ui'] === '') {
    delete partialProfile['external-ui']
    delete partialProfile['external-ui-url']
  }
}

function configureLanSettings(profile: MihomoConfig): void {
  const partialProfile = profile as Partial<MihomoConfig>

  if (profile['allow-lan'] === false) {
    delete partialProfile['lan-allowed-ips']
    delete partialProfile['lan-disallowed-ips']
    return
  }

  if (!profile['allow-lan']) {
    delete partialProfile['allow-lan']
    delete partialProfile['lan-allowed-ips']
    delete partialProfile['lan-disallowed-ips']
    return
  }

  const allowedIps = profile['lan-allowed-ips']
  if (allowedIps?.length === 0) {
    delete partialProfile['lan-allowed-ips']
  } else if (allowedIps && !allowedIps.some((ip: string) => ip.startsWith('127.0.0.1/'))) {
    allowedIps.push('127.0.0.1/8')
  }

  if (profile['lan-disallowed-ips']?.length === 0) {
    delete partialProfile['lan-disallowed-ips']
  }
}

function cleanAuthenticationConfig(profile: MihomoConfig): void {
  if (profile.authentication?.length === 0) {
    const partialProfile = profile as Partial<MihomoConfig>
    delete partialProfile.authentication
    delete partialProfile['skip-auth-prefixes']
  }
}

function cleanTunConfig(profile: MihomoConfig): void {
  if (!profile.tun?.enable) {
    delete (profile as Partial<MihomoConfig>).tun
    return
  }

  const tunConfig = profile.tun as MihomoTunConfig

  if (tunConfig['auto-route'] !== false) {
    delete tunConfig['auto-route']
  }
  if (tunConfig['auto-detect-interface'] !== false) {
    delete tunConfig['auto-detect-interface']
  }

  const tunBooleanConfigs = ['auto-redirect', 'strict-route', 'disable-icmp-forwarding']
  tunBooleanConfigs.forEach((key) => {
    if (!tunConfig[key]) delete tunConfig[key]
  })

  if (tunConfig.device === '') {
    delete tunConfig.device
  } else if (
    process.platform === 'darwin' &&
    tunConfig.device &&
    !tunConfig.device.startsWith('utun')
  ) {
    delete tunConfig.device
  }

  if (tunConfig['dns-hijack']?.length === 0) delete tunConfig['dns-hijack']
  if (tunConfig['route-exclude-address']?.length === 0) delete tunConfig['route-exclude-address']
}

function cleanDnsConfig(profile: MihomoConfig, controlDns: boolean): void {
  if (!controlDns) return
  if (!profile.dns?.enable) {
    delete (profile as Partial<MihomoConfig>).dns
    return
  }

  const dnsConfig = profile.dns as MihomoDNSConfig
  const dnsArrayConfigs = [
    'fake-ip-range',
    'fake-ip-range6',
    'fake-ip-filter',
    'proxy-server-nameserver',
    'direct-nameserver',
    'nameserver'
  ]

  dnsArrayConfigs.forEach((key) => {
    if (dnsConfig[key]?.length === 0) delete dnsConfig[key]
  })

  if (dnsConfig['respect-rules'] === false || dnsConfig['proxy-server-nameserver']?.length === 0) {
    delete dnsConfig['respect-rules']
  }

  if (dnsConfig['nameserver-policy'] && Object.keys(dnsConfig['nameserver-policy']).length === 0) {
    delete dnsConfig['nameserver-policy']
  }

  delete dnsConfig.fallback
  delete dnsConfig['fallback-filter']
}

function cleanSnifferConfig(profile: MihomoConfig, controlSniff: boolean): void {
  if (!controlSniff) return
  if (!profile.sniffer?.enable) {
    delete (profile as Partial<MihomoConfig>).sniffer
  }
}

function cleanProxyConfigs(profile: MihomoConfig): void {
  const partialProfile = profile as Partial<MihomoConfig>
  const arrayConfigs = ['proxies', 'proxy-groups', 'rules']
  const objectConfigs = ['proxy-providers', 'rule-providers']

  arrayConfigs.forEach((key) => {
    if (Array.isArray(profile[key]) && profile[key]?.length === 0) {
      delete partialProfile[key]
    }
  })

  objectConfigs.forEach((key) => {
    const value = profile[key]
    if (
      value === null ||
      value === undefined ||
      (value && typeof value === 'object' && Object.keys(value).length === 0)
    ) {
      delete partialProfile[key]
    }
  })
}

async function prepareProfileWorkDir(current: string | undefined): Promise<void> {
  if (!existsSync(mihomoProfileWorkDir(current))) {
    await mkdir(mihomoProfileWorkDir(current), { recursive: true })
  }
  const copy = async (file: string): Promise<void> => {
    const targetPath = path.join(mihomoProfileWorkDir(current), file)
    const sourcePath = path.join(mihomoWorkDir(), file)
    
    let shouldCopy = !existsSync(targetPath)
    if (!shouldCopy) {
      try {
        const stats = await stat(targetPath)
        if (stats.size === 0) {
          shouldCopy = true
          await rm(targetPath, { force: true }).catch(() => {})
        }
      } catch {
        shouldCopy = true
      }
    }

    if (shouldCopy && existsSync(sourcePath)) {
      try {
        await copyFile(sourcePath, targetPath)
      } catch (e) {
        // Copy failed, ensure target is removed to avoid corrupted file preventing future copies
        // and allow retry on next launch
        if (existsSync(targetPath)) {
          await rm(targetPath, { force: true }).catch(() => {})
        }
        console.error(`[Factory] Failed to copy resource ${file}:`, e)
        // We rethrow to stop startup if critical resources fail
        throw e
      }
    }
  }
  await Promise.all([
    copy('country.mmdb'),
    copy('geoip.metadb'),
    copy('geoip.dat'),
    copy('geosite.dat'),
    copy('ASN.mmdb')
  ])
}

async function overrideProfile(
  current: string | undefined,
  profile: MihomoConfig
): Promise<MihomoConfig> {
  const { items = [] } = (await getOverrideConfig()) || {}
  const globalOverride = items.filter((item) => item.global).map((item) => item.id)
  const { override = [] } = (await getProfileItem(current)) || {}
  for (const ov of new Set(globalOverride.concat(override))) {
    const item = await getOverrideItem(ov)
    const content = await getOverride(ov, item?.ext || 'js')
    switch (item?.ext) {
      case 'js':
        profile = await runOverrideScript(profile, content, item)
        break
      case 'yaml': {
        let patch = parseYaml<Partial<MihomoConfig>>(content)
        if (typeof patch !== 'object') patch = {}
        profile = deepMerge(profile, patch, true)
        break
      }
    }
  }
  return profile
}

async function runOverrideScript(
  profile: MihomoConfig,
  script: string,
  item: OverrideItem
): Promise<MihomoConfig> {
  const log = (type: string, data: string, flag = 'a'): void => {
    writeFileSync(overridePath(item.id, 'log'), `[${type}] ${data}\n`, {
      encoding: 'utf-8',
      flag
    })
  }
  try {
    const b64d = (str: string): string => Buffer.from(str, 'base64').toString('utf-8')
    const b64e = (data: Buffer | string): string =>
      (Buffer.isBuffer(data) ? data : Buffer.from(String(data))).toString('base64')
    const ctx = {
      console: Object.freeze({
        log: (...args: unknown[]) => log('log', args.map(format).join(' ')),
        info: (...args: unknown[]) => log('info', args.map(format).join(' ')),
        error: (...args: unknown[]) => log('error', args.map(format).join(' ')),
        debug: (...args: unknown[]) => log('debug', args.map(format).join(' '))
      }),
      fetch,
      yaml: { parse: parseYaml, stringify: stringifyYaml },
      b64d,
      b64e,
      Buffer
    }
    vm.createContext(ctx)
    log('info', '开始执行脚本', 'w')
    vm.runInContext(script, ctx)
    const promise = vm.runInContext(
      `(async () => {
        const result = main(${JSON.stringify(profile)})
        if (result instanceof Promise) return await result
        return result
      })()`,
      ctx
    )
    const newProfile = await promise
    if (typeof newProfile !== 'object') {
      throw new Error('脚本返回值必须是对象')
    }
    log('info', '脚本执行成功')
    return newProfile
  } catch (e) {
    log('exception', `脚本执行失败：${e}`)
    return profile
  }
}

function format(data: unknown): string {
  if (data instanceof Error) {
    return `${data.name}: ${data.message}\n${data.stack}`
  }
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

export async function getRuntimeConfigStr(): Promise<string> {
  return runtimeConfigStr
}

export async function getRawProfileStr(): Promise<string> {
  return rawProfileStr
}

export async function getCurrentProfileStr(): Promise<string> {
  return currentProfileStr
}

export async function getOverrideProfileStr(): Promise<string> {
  return overrideProfileStr
}

export async function getRuntimeConfig(): Promise<MihomoConfig> {
  return runtimeConfig
}
