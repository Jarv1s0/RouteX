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
  const chainsConfig = await getChainsConfig()
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
  // 这是为了防止普通代理引用了代理链，而代理链又引用了该普通代理（或通过其他链间接引用）形成环路
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

  // 2. 筛选活跃的代理链并构建潜在依赖
  const activeChains = chainsConfig.items.filter(
    (c) => c.enabled !== false && c.name && c.targetProxy && c.dialerProxy
  )

  for (const chain of activeChains) {
    const { name, dialerProxy, targetGroups } = chain
    
    // Chain -> Dialer
    if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set())
    dependencyGraph.get(name)?.add(dialerProxy)

    // Chain -> Target (防止 Target 是 Group 或其他 Chain 导致的环路)
    // 注意：虽然 target 实际上是被克隆的（作为模板），但如果 target 是一个 Group，那么流量确实会流向 target
    // 如果 target 是一个 Proxy，依赖也是存在的（虽然被克隆了，但逻辑上 Chain 使用了 Target 的配置）
    if (!dependencyGraph.has(name)) dependencyGraph.set(name, new Set())
    dependencyGraph.get(name)?.add(chain.targetProxy)

    // Group -> Chain (因为 Chain 被加入到了 Group 中，所以流量可能从 Group 流向 Chain)
    if (targetGroups && Array.isArray(targetGroups)) {
      for (const groupName of targetGroups) {
        if (!dependencyGraph.has(groupName)) dependencyGraph.set(groupName, new Set())
        dependencyGraph.get(groupName)?.add(name)
      }
    }
  }

  // 3. DFS 检测环路
  const hasLoop = (startNode: string, visited = new Set<string>(), stack = new Set<string>()): boolean => {
    visited.add(startNode)
    stack.add(startNode)

    const neighbors = dependencyGraph.get(startNode)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasLoop(neighbor, visited, stack)) return true
        } else if (stack.has(neighbor)) {
          return true
        }
      }
    }

    stack.delete(startNode)
    return false
  }

  const safeChains: typeof activeChains = []
  for (const chain of activeChains) {
    // 每次检测都使用新的 visited/stack，确保独立性
    // 只要能从 chain.name 出发并回到 chain.name，即视为该 chain 参与了环路
    if (hasLoop(chain.name, new Set(), new Set())) {
      console.error(`[Factory] Detected loop for chain "${chain.name}" (dialer: "${chain.dialerProxy}"), skipping to prevent memory overflow.`)
      continue
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

    // 验证前置和落地节点是否存在于当前配置中 (Proxies 或 Groups)
    // 注意：前置节点可能就是另一个 Chain，所以这里只要在 safeChains 或 existing 中即可
    // 但为了简化，这里只检查是否在“最终会存在的集合”中有点复杂
    // 保持原有逻辑：检查 profile 中是否存在，或者是否是本次新加的 chain (safeChains)
    // 实际上依赖图中已经处理了关系，这里主要防止引用了不存在的节点导致内核报错
    
    // 简单检查 targets 是否在基础配置中 (不依赖顺序，因为 safeChains 内部可能互相引用)
    // 只要 dialer 在 proxies/groups OR 是其他的 safeChain.name 即可
    const targetExists = 
      (profile.proxies as any[])?.some(p => p.name === chain.targetProxy) ||
      (profile['proxy-groups'] as any[])?.some(g => g.name === chain.targetProxy)

    // 落地节点必须存在（因为需要克隆配置），前置节点可以是 Provider 中的节点（动态的），所以不强制检查前置节点是否存在
    if (!targetExists) {
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
