import { useMemo } from 'react'
import { getGroupCurrentDelay, getProxyDisplayDelay } from '@renderer/utils/proxy-delay'

function getHistoryVersion(history?: ControllerProxiesHistory[]): string {
  if (!history?.length) return ''
  const latest = history[history.length - 1]
  return `${latest.time}:${latest.delay}`
}

export function getDelayVersion(groups: ControllerMixedGroup[]): string {
  const visited = new WeakSet<object>()

  const visit = (proxy: ControllerProxiesDetail | ControllerGroupDetail): string => {
    if (visited.has(proxy)) return ''
    visited.add(proxy)

    const base = [proxy.name, getHistoryVersion(proxy.history)]

    if ('now' in proxy) {
      base.push(proxy.now)
      for (const child of proxy.all || []) {
        const candidate: unknown = child
        if (candidate !== null && typeof candidate === 'object' && 'name' in candidate) {
          base.push(visit(candidate as ControllerProxiesDetail | ControllerGroupDetail))
        }
      }
    }

    return base.join(':')
  }

  return groups.map(visit).join('\n')
}

export function getGroupAvailableCount(group: ControllerMixedGroup): number {
  return (group.all || []).reduce((count, proxy) => {
    const delay = getProxyDisplayDelay(proxy)
    if (delay === 0) return count
    return count + 1
  }, 0)
}

export function getAutoDelayGroupSignature(groups: ControllerMixedGroup[]): string {
  return groups
    .map((group) => {
      const childNames = (group.all || []).map((proxy) => proxy?.name || '').join('\u0002')
      return `${group.name}\u0000${childNames}`
    })
    .join('\u0001')
}

export type FlatItem =
  | { type: 'header'; groupIndex: number }
  | {
      type: 'proxies'
      groupIndex: number
      proxies: (ControllerProxiesDetail | ControllerGroupDetail)[]
    }

interface UseProxyListModelProps {
  mode: string
  allGroups: ControllerMixedGroup[]
  groupOrder: string[]
  proxyDisplayOrder: string
  proxyCols: string
  isOpen: Record<string, boolean>
}

export function useProxyListModel({
  mode,
  allGroups,
  groupOrder,
  proxyDisplayOrder,
  proxyCols,
  isOpen
}: UseProxyListModelProps) {
  // 1. Filter by mode
  const filteredGroups = useMemo(() => {
    if (mode === 'global') {
      return allGroups.filter((group) => group.name === 'GLOBAL')
    }
    return allGroups.filter((group) => group.name !== 'GLOBAL')
  }, [allGroups, mode])

  // 2. Sort by groupOrder
  const renderGroups = useMemo(() => {
    if (groupOrder.length === 0) return filteredGroups
    const orderMap = new Map(groupOrder.map((name, index) => [name, index]))
    return [...filteredGroups].sort((a, b) => {
      const aIndex = orderMap.get(a.name) ?? Infinity
      const bIndex = orderMap.get(b.name) ?? Infinity
      return aIndex - bIndex
    })
  }, [filteredGroups, groupOrder])

  // 3. Derived metrics
  const delayVersion = useMemo(() => getDelayVersion(renderGroups), [renderGroups])

  const proxyGroupMetrics = useMemo(() => {
    const metrics = new Map<string, { currentDelay: number; liveCount: number }>()
    renderGroups.forEach((group) => {
      metrics.set(group.name, {
        currentDelay: getGroupCurrentDelay(group),
        liveCount: getGroupAvailableCount(group)
      })
    })
    return metrics
  }, [delayVersion, renderGroups])

  const autoDelayGroupSignature = useMemo(() => getAutoDelayGroupSignature(renderGroups), [renderGroups])

  // 4. Calculate chunks
  const chunkSize = useMemo(() => {
    if (proxyCols === 'auto') return 24
    return parseInt(proxyCols) || 3
  }, [proxyCols])

  // 5. Flatten structure for Virtuoso
  const flatItems = useMemo(() => {
    const items: FlatItem[] = []

    renderGroups.forEach((group, index) => {
      items.push({ type: 'header', groupIndex: index })

      if (isOpen[group.name]) {
        let groupProxies = (group.all || []).filter(
          (proxy): proxy is ControllerProxiesDetail | ControllerGroupDetail => Boolean(proxy)
        )

        if (proxyDisplayOrder === 'delay') {
          groupProxies = groupProxies.sort((a, b) => {
            const aDelay = getProxyDisplayDelay(a)
            const bDelay = getProxyDisplayDelay(b)
            if (aDelay === -1) return -1
            if (bDelay === -1) return 1
            if (aDelay === 0) return 1
            if (bDelay === 0) return -1
            return aDelay - bDelay
          })
        }
        if (proxyDisplayOrder === 'name') {
          groupProxies = groupProxies.sort((a, b) => a.name.localeCompare(b.name))
        }

        for (let i = 0; i < groupProxies.length; i += chunkSize) {
          items.push({
            type: 'proxies',
            groupIndex: index,
            proxies: groupProxies.slice(i, i + chunkSize)
          })
        }
      }
    })
    return items
  }, [renderGroups, isOpen, proxyDisplayOrder, chunkSize])

  return {
    renderGroups,
    delayVersion,
    proxyGroupMetrics,
    autoDelayGroupSignature,
    chunkSize,
    flatItems
  }
}
