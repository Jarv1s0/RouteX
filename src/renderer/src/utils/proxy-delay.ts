import { useGroupsStore } from '@renderer/store/use-groups-store'

export type ProxyDelayTarget = ControllerProxiesDetail | ControllerGroupDetail
type DelayCandidate = {
  delay: number
  order: number
  time: number
}

function isProxyGroup(proxy: ProxyDelayTarget): proxy is ControllerGroupDetail {
  return 'now' in proxy && typeof proxy.now === 'string'
}

function isResolvedProxy(value: unknown): value is ProxyDelayTarget {
  return Boolean(value && typeof value === 'object' && 'name' in value)
}

function resolveProxyChild(child: unknown): ProxyDelayTarget | undefined {
  if (isResolvedProxy(child)) return child
  return typeof child === 'string' ? getGlobalProxy(child) : undefined
}

export function getLatestDelay(proxy?: { history?: ControllerProxiesHistory[] }): number {
  return proxy?.history?.length ? proxy.history[proxy.history.length - 1].delay : -1
}

function getGlobalProxy(name: string): ProxyDelayTarget | undefined {
  const groups = useGroupsStore.getState().groups
  if (!groups) return undefined
  const visited = new WeakSet<object>()

  const findInTarget = (target: ProxyDelayTarget): ProxyDelayTarget | undefined => {
    if (visited.has(target)) return undefined
    visited.add(target)

    if (target.name === name) return target
    if (!isProxyGroup(target)) return undefined

    for (const child of target.all || []) {
      const candidate = isResolvedProxy(child) ? child : undefined
      if (!candidate) continue
      const found = findInTarget(candidate)
      if (found) return found
    }

    return undefined
  }

  for (const group of groups) {
    const found = findInTarget(group)
    if (found) return found
  }
  return undefined
}

function delayCandidate(
  history: ControllerProxiesHistory[] | undefined,
  order: number
): DelayCandidate | undefined {
  if (!history?.length) return undefined

  const latest = history[history.length - 1]
  const parsedTime = Date.parse(latest.time)
  return {
    delay: latest.delay,
    order,
    time: Number.isFinite(parsedTime) ? parsedTime : 0
  }
}

function newerDelayCandidate(
  current: DelayCandidate | undefined,
  next: DelayCandidate | undefined
): DelayCandidate | undefined {
  if (!next) return current
  if (!current) return next
  if (next.time !== current.time) return next.time > current.time ? next : current
  return next.order > current.order ? next : current
}

function getSharedDelay(name: string): number {
  const groups = useGroupsStore.getState().groups
  if (!groups?.length) return -1

  let order = 0
  let best: DelayCandidate | undefined
  const visited = new WeakSet<object>()

  const visit = (proxy: ProxyDelayTarget): void => {
    if (visited.has(proxy)) return
    visited.add(proxy)

    if (!isProxyGroup(proxy) && proxy.name === name) {
      best = newerDelayCandidate(best, delayCandidate(proxy.history, order++))
    }

    if (isProxyGroup(proxy)) {
      for (const child of proxy.all || []) {
        if (isResolvedProxy(child)) {
          visit(child)
        }
      }
    }
  }

  groups.forEach(visit)
  return best?.delay ?? -1
}

function getResolvedCurrentProxy(
  proxy: ControllerGroupDetail,
  seen = new Set<string>()
): ProxyDelayTarget | undefined {
  if (!proxy.now || seen.has(proxy.name)) return undefined
  seen.add(proxy.name)

  const children = Array.isArray(proxy.all) ? (proxy.all as unknown[]) : []
  let current = children.find((child) => isResolvedProxy(child) && child.name === proxy.now)

  // 如果子节点只是字符串（例如嵌套子组的情况），从全局 Store 查找真实的节点对象
  if (!isResolvedProxy(current)) {
    current = getGlobalProxy(proxy.now)
  }

  if (!isResolvedProxy(current)) return undefined
  if (isProxyGroup(current)) return getResolvedCurrentProxy(current, seen) ?? current
  return current
}

export function getResolvedProxyTarget(proxy?: ProxyDelayTarget): ControllerProxiesDetail | undefined {
  if (!proxy) return undefined
  if (!isProxyGroup(proxy)) return proxy

  const current = getResolvedCurrentProxy(proxy)
  return current && !isProxyGroup(current) ? current : undefined
}

export function getResolvedProxyTargets(proxy?: ProxyDelayTarget): ControllerProxiesDetail[] {
  if (!proxy) return []
  if (!isProxyGroup(proxy)) return [proxy]

  const targets = new Map<string, ControllerProxiesDetail>()
  const seen = new Set<string>()
  const current = getResolvedProxyTarget(proxy)

  const addTarget = (target: ControllerProxiesDetail): void => {
    if (!targets.has(target.name)) {
      targets.set(target.name, target)
    }
  }

  if (current) addTarget(current)

  const visit = (target: ProxyDelayTarget): void => {
    if (seen.has(target.name)) return
    seen.add(target.name)

    if (!isProxyGroup(target)) {
      addTarget(target)
      return
    }

    for (const child of target.all || []) {
      const candidate = resolveProxyChild(child)
      if (candidate) {
        visit(candidate)
      }
    }
  }

  visit(proxy)

  return Array.from(targets.values())
}

export function getProxyDisplayDelay(proxy?: ProxyDelayTarget): number {
  if (!proxy) return -1
  if (!isProxyGroup(proxy)) {
    const sharedDelay = getSharedDelay(proxy.name)
    return sharedDelay !== -1 ? sharedDelay : getLatestDelay(proxy)
  }

  const current = getResolvedProxyTarget(proxy)
  const currentDelay = current ? getProxyDisplayDelay(current) : -1
  if (currentDelay !== -1) return currentDelay

  return getLatestDelay(proxy)
}

/**
 * 获取组当前选中节点的延迟。
 * 只解析到最终叶子节点，并按节点名复用全局最新测速结果，保证同一真实节点在多个组卡片中显示一致。
 */
export function getGroupCurrentDelay(group: ControllerMixedGroup): number {
  return getProxyDisplayDelay(group)
}
