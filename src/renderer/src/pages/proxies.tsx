import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import EmptyState from '@renderer/components/base/empty-state'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getGroupCurrentDelay,
  getProxyDisplayDelay,
  getResolvedProxyTarget,
  getResolvedProxyTargets
} from '@renderer/utils/proxy-delay'
import { debugLog, warnLog } from '@renderer/utils/logger'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  mihomoProxyDelay
} from '@renderer/utils/mihomo-ipc'
import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import ProxyChainModal from '@renderer/components/proxies/proxy-chain-modal'
import { MdTune, MdLink } from 'react-icons/md'
import { TbBolt } from 'react-icons/tb'
import { useGroups } from '@renderer/hooks/use-groups'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { ProxyGroupCard } from '@renderer/components/proxies/proxy-group-card'
import { ProxyCardSkeleton } from '@renderer/components/base/skeleton'
import { useI18n } from '@renderer/i18n'

const DEFAULT_DELAY_TEST_CONCURRENCY = 4
const MAX_DELAY_TEST_CONCURRENCY = 8
const DELAY_TEST_MUTATE_BATCH_MS = 700
const AUTO_DELAY_TTL_MS = 5 * 60 * 1000
const AUTO_DELAY_IDLE_BACKFILL_MS = 5000

// ----------------------------------------
// ProxyRowChunk: 独立的 Grid 块渲染组件，用于性能优化
// ----------------------------------------
interface ProxyRowChunkProps {
  proxies: (ControllerProxiesDetail | ControllerGroupDetail)[]
  group: ControllerMixedGroup
  isAuto: boolean
  chunkSize: number
  delayVersion: string
  mutate: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<ControllerProxiesDelay>
  onChangeProxy: (group: string, proxy: string) => Promise<void>
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
}

const ProxyRowChunk = memo(
  ({
    proxies,
    group,
    isAuto,
    chunkSize,
    delayVersion,
    mutate,
    onProxyDelay,
    onChangeProxy,
    proxyDisplayLayout
  }: ProxyRowChunkProps) => {
    return (
      <div
        style={
          !isAuto
            ? { gridTemplateColumns: `repeat(${chunkSize}, minmax(0, 1fr))` }
            : {}
        }
        className={`w-full grid ${
          isAuto
            ? 'grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]'
            : ''
        } gap-2 px-2 pt-2 pb-1`}
      >
        {proxies.map((proxy, i) => {
          if (!proxy) return null
          return (
            <ProxyItem
              key={proxy.name}
              mutateProxies={mutate}
              onProxyDelay={onProxyDelay}
              onSelect={onChangeProxy}
              proxy={proxy}
              group={group}
              delayVersion={delayVersion}
              proxyDisplayLayout={proxyDisplayLayout}
              selected={proxy.name === group.now}
              index={i}
            />
          )
        })}
      </div>
    )
  },
  (prev, next) => {
    // 粗略比较，只有同名节点、选择状态及布局配置发生变化时重渲染。
    // 由于外部 mutate 会刷新整个引用，我们需要按值比较核心变化点。
    if (prev.isAuto !== next.isAuto) return false
    if (prev.chunkSize !== next.chunkSize) return false
    if (prev.delayVersion !== next.delayVersion) return false
    if (prev.proxyDisplayLayout !== next.proxyDisplayLayout) return false
    if (prev.group.now !== next.group.now) return false
    if (prev.group.name !== next.group.name) return false
    if (prev.proxies.length !== next.proxies.length) return false
    
    // 如果测速改变了 delay，我们需要依赖组件内部的 delay 更新或者判断 reference
    // 由于 proxy 对象包含 history 且可能频繁变化，我们需要检查每个代理的基础属性和历史记录最后一次延迟
    for (let i = 0; i < prev.proxies.length; i++) {
        const p1 = prev.proxies[i]
        const p2 = next.proxies[i]
        if (p1.name !== p2.name) return false
        if (p1.type !== p2.type) return false
        
        const d1 = p1.history?.length ? p1.history[p1.history.length - 1].delay : -1
        const d2 = p2.history?.length ? p2.history[p2.history.length - 1].delay : -1
        if (d1 !== d2) return false

        const p1Now = 'now' in p1 ? p1.now : undefined
        const p2Now = 'now' in p2 ? p2.now : undefined
        if (p1Now !== p2Now) return false

        const p1ChildrenCount = 'all' in p1 && Array.isArray(p1.all) ? p1.all.length : -1
        const p2ChildrenCount = 'all' in p2 && Array.isArray(p2.all) ? p2.all.length : -1
        if (p1ChildrenCount !== p2ChildrenCount) return false
    }

    return true
  }
)

ProxyRowChunk.displayName = 'ProxyRowChunk'

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number
): Promise<void> {
  let currentIndex = 0

  const worker = async (): Promise<void> => {
    while (true) {
      const taskIndex = currentIndex
      currentIndex += 1
      if (taskIndex >= tasks.length) return
      await tasks[taskIndex]()
    }
  }

  const workerCount = Math.min(concurrency, tasks.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

function normalizeDelayTestConcurrency(value?: number): number {
  const parsed = Number.parseInt(String(value ?? DEFAULT_DELAY_TEST_CONCURRENCY), 10)
  if (!Number.isFinite(parsed)) return DEFAULT_DELAY_TEST_CONCURRENCY
  return Math.min(MAX_DELAY_TEST_CONCURRENCY, Math.max(1, parsed))
}

function getHistoryVersion(history?: ControllerProxiesHistory[]): string {
  if (!history?.length) return ''
  const latest = history[history.length - 1]
  return `${latest.time}:${latest.delay}`
}

function getDelayVersion(groups: ControllerMixedGroup[]): string {
  const visited = new WeakSet<object>()

  const visit = (proxy: ControllerProxiesDetail | ControllerGroupDetail): string => {
    if (visited.has(proxy)) return ''
    visited.add(proxy)

    const base = [
      proxy.name,
      getHistoryVersion(proxy.history)
    ]

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

function shouldAutoDelay(proxy?: ControllerProxiesDetail): boolean {
  if (!proxy) return false

  const latest = proxy.history?.[proxy.history.length - 1]
  if (!latest) return true

  const time = Date.parse(latest.time)
  if (!Number.isFinite(time)) return true

  return Date.now() - time > AUTO_DELAY_TTL_MS
}

function getGroupAvailableCount(group: ControllerMixedGroup): number {
  return (group.all || []).reduce((count, proxy) => {
    const delay = getProxyDisplayDelay(proxy)

    // delay === 0 是 Mihomo 测速失败/超时的明确结果；未测速 delay === -1 不应被当成不可用。
    if (delay === 0) return count

    return count + 1
  }, 0)
}

function getAutoDelayGroupSignature(groups: ControllerMixedGroup[]): string {
  return groups
    .map((group) => {
      const childNames = (group.all || [])
        .map((proxy) => proxy?.name || '')
        .join('\u0002')
      return `${group.name}\u0000${childNames}`
    })
    .join('\u0001')
}

type ResolvedDelayTarget = {
  proxyName: string
  testUrl?: string
}

type RunDelayTargetsOptions = {
  groupsForLoading?: ControllerMixedGroup[]
  logScope: string
  concurrency?: number
  shouldContinue?: () => boolean
}

function pushAutoDelayTarget(
  targets: Map<string, ResolvedDelayTarget>,
  proxy: ControllerProxiesDetail | undefined,
  testUrl?: string,
  options: { respectTtl?: boolean } = {}
): void {
  if (!proxy) return
  if (options.respectTtl !== false && !shouldAutoDelay(proxy)) return
  if (targets.has(proxy.name)) return

  targets.set(proxy.name, {
    proxyName: proxy.name,
    testUrl
  })
}

function getCurrentSelectedDelayTargets(groups: ControllerMixedGroup[]): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()

  groups.forEach((group) => {
    pushAutoDelayTarget(targets, getResolvedProxyTarget(group), group.testUrl)
  })

  return Array.from(targets.values())
}

function getDirectGroupDelayTargets(group: ControllerMixedGroup): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()

  for (const proxy of group.all || []) {
    const target = 'now' in proxy ? getResolvedProxyTarget(proxy) : proxy
    pushAutoDelayTarget(targets, target, group.testUrl)
  }

  return Array.from(targets.values())
}

function getAutoBackfillDelayTargets(groups: ControllerMixedGroup[]): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()

  groups.forEach((group) => {
    getResolvedProxyTargets(group).forEach((target) => {
      pushAutoDelayTarget(targets, target, group.testUrl)
    })
  })

  return Array.from(targets.values())
}

function createMutateBatcher(mutate: () => void | Promise<void>, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> | null = null
  let lastRunAt = 0
  let pendingRefresh = false

  const clearTimer = (): void => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  const runPendingRefresh = async (): Promise<void> => {
    if (inFlight) {
      await inFlight
    }
    if (!pendingRefresh) return

    pendingRefresh = false
    lastRunAt = Date.now()
    inFlight = Promise.resolve(mutate()).finally(() => {
      inFlight = null
    })

    await inFlight
  }

  return {
    schedule(): void {
      pendingRefresh = true
      const delay = waitMs - (Date.now() - lastRunAt)
      if (delay <= 0) {
        clearTimer()
        void runPendingRefresh()
        return
      }

      if (timer !== null) return

      timer = setTimeout(() => {
        timer = null
        void runPendingRefresh()
      }, delay)
    },
    async flush(): Promise<void> {
      clearTimer()
      await runPendingRefresh()
    },
    cancel(): void {
      clearTimer()
      pendingRefresh = false
    }
  }
}

const Proxies: React.FC = () => {
  const { t } = useI18n()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups: allGroups = [], mutate, isLoading } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    proxyCols = 'auto',
    groupOrder = [],
    autoDelayTestOnShow = true,
    delayTestConcurrency = DEFAULT_DELAY_TEST_CONCURRENCY
  } = appConfig || {}
  // 根据模式过滤显示的组
  const filteredGroups = useMemo(() => {
    if (mode === 'global') {
      return allGroups.filter(group => group.name === 'GLOBAL')
    }
    return allGroups.filter(group => group.name !== 'GLOBAL')
  }, [allGroups, mode])

  // 根据 groupOrder 排序
  const groups = useMemo(() => {
    if (groupOrder.length === 0) return filteredGroups
    const orderMap = new Map(groupOrder.map((name, index) => [name, index]))
    return [...filteredGroups].sort((a, b) => {
      const aIndex = orderMap.get(a.name) ?? Infinity
      const bIndex = orderMap.get(b.name) ?? Infinity
      return aIndex - bIndex
    })
  }, [filteredGroups, groupOrder])
  const renderGroups = groups
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
  const autoDelayGroupSignature = useMemo(() => getAutoDelayGroupSignature(groups), [groups])
  // 使用 ref 存储最新引用，避免 useEffect 捕获过期数据。
  const groupsRef = useRef(renderGroups)
  groupsRef.current = renderGroups
  const mutateRef = useRef(mutate)
  mutateRef.current = mutate
  const delayTestConcurrencyRef = useRef(delayTestConcurrency)
  delayTestConcurrencyRef.current = delayTestConcurrency

  // Determine a reasonable chunk size based on proxyCols preference
  const chunkSize = useMemo(() => {
    if (proxyCols === 'auto') return 24
    return parseInt(proxyCols) || 3
  }, [proxyCols])

  const [isOpen, setIsOpen] = useState<Record<string, boolean>>({})
  const [delaying, setDelaying] = useState<Record<string, boolean>>({})
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const setGroupsDelaying = useCallback(
    (targetGroups: ControllerMixedGroup[], value: boolean): void => {
      if (targetGroups.length === 0) return

      setDelaying((prev) => ({
        ...prev,
        ...Object.fromEntries(targetGroups.map((group) => [group.name, value]))
      }))
    },
    []
  )

  // 扁平化数据结构
  type FlatItem =
    | { type: 'header'; groupIndex: number }
    | { type: 'proxies'; groupIndex: number; proxies: (ControllerProxiesDetail | ControllerGroupDetail)[] }

  const flatItems = useMemo(() => {
    const items: FlatItem[] = []
    
    renderGroups.forEach((group, index) => {
      // 添加组头
      items.push({ type: 'header', groupIndex: index })
      
      // 如果展开，添加代理行
      const isGroupOpen = !!isOpen[group.name]

      if (isGroupOpen) {
        let groupProxies = (group.all || []).filter(
          (proxy): proxy is ControllerProxiesDetail | ControllerGroupDetail => Boolean(proxy)
        )

        // 排序逻辑
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

        // 分组为大的虚拟化行/块
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



  const runDelayTargets = useCallback(
    async (
      delayTargets: ResolvedDelayTarget[],
      options: RunDelayTargetsOptions
    ): Promise<boolean> => {
      if (delayTargets.length === 0) return false
      if (options.shouldContinue && !options.shouldContinue()) return false

      const loadingGroups = options.groupsForLoading || []
      setGroupsDelaying(loadingGroups, true)

      const mutateBatcher = createMutateBatcher(
        () => mutateRef.current(),
        DELAY_TEST_MUTATE_BATCH_MS
      )

      try {
        const tasks = delayTargets.map((target) => async (): Promise<void> => {
          if (options.shouldContinue && !options.shouldContinue()) return

          debugLog(`[proxy-delay:${options.logScope}] test proxy`, target.proxyName)
          await mihomoProxyDelay(target.proxyName, target.testUrl).catch((error) => {
            warnLog(`[proxy-delay:${options.logScope}] failed`, target.proxyName, error)
          })

          if (options.shouldContinue && !options.shouldContinue()) return
          mutateBatcher.schedule()
        })

        await runWithConcurrency(
          tasks,
          normalizeDelayTestConcurrency(options.concurrency ?? delayTestConcurrencyRef.current)
        )
        if (options.shouldContinue && !options.shouldContinue()) return false

        await mutateBatcher.flush()
        return options.shouldContinue ? options.shouldContinue() : true
      } finally {
        mutateBatcher.cancel()
        setGroupsDelaying(loadingGroups, false)
      }
    },
    [setGroupsDelaying]
  )

  const onChangeProxy = useCallback(
    async (group: string, proxy: string): Promise<void> => {
      await mihomoChangeProxy(group, proxy)
      mutate()

      if (autoCloseConnection) {
        void mihomoCloseAllConnections(group).catch((error) => {
          warnLog('[proxy-select] close connections failed', group, error)
        })
      }
    },
    [autoCloseConnection, mutate]
  )

  const onProxyDelay = useCallback(
    async (proxy: string, url?: string): Promise<ControllerProxiesDelay> => {
      return await mihomoProxyDelay(proxy, url)
    },
    []
  )

  const onGroupDelay = useCallback(
    async (groupName: string): Promise<void> => {
      setDelaying((prev) => ({ ...prev, [groupName]: true }))
      const mutateBatcher = createMutateBatcher(mutate, DELAY_TEST_MUTATE_BATCH_MS)

      try {
        const group = groupsRef.current.find((item) => item.name === groupName)
        await mihomoGroupDelay(groupName, group?.testUrl)
        mutateBatcher.schedule()
        await mutateBatcher.flush()
      } catch (error) {
        warnLog('[proxy-delay:group] failed', groupName, error)
      } finally {
        mutateBatcher.cancel()
        setDelaying((prev) => ({ ...prev, [groupName]: false }))
      }
    },
    [mutate]
  )

  const delayOpenedGroup = useCallback(
    async (groupName: string): Promise<void> => {
      const group = groupsRef.current.find((item) => item.name === groupName)
      if (!group) return

      const delayTargets = getDirectGroupDelayTargets(group)
      await runDelayTargets(delayTargets, {
        groupsForLoading: [group],
        logScope: 'open-group'
      })
    },
    [runDelayTargets]
  )

  const toggleOpen = useCallback((groupName: string) => {
    setIsOpen((prev) => {
      const nextOpen = !prev[groupName]
      if (nextOpen && autoDelayTestOnShow) {
        void delayOpenedGroup(groupName)
      }
      return { ...prev, [groupName]: nextOpen }
    })
  }, [autoDelayTestOnShow, delayOpenedGroup])

  // 首次进入页面时自动测速，及周期性定时测速
  const hasInitialTestRef = useRef(false)
  const isTestingRef = useRef(false)
  const isBackfillingRef = useRef(false)
  const autoTestGenerationRef = useRef(0)

  useEffect(() => {
    const currentGroups = groupsRef.current
    if (currentGroups.length === 0) return
    // 既不启用首次测速，也不启用周期测速时，直接返回
    if (!autoDelayTestOnShow) return

    let disposed = false
    const resetAutoDelayState = (): void => {
      setGroupsDelaying(groupsRef.current, false)
    }
    const isCurrentAutoTest = (runId: number): boolean => {
      return !disposed && autoTestGenerationRef.current === runId && !document.hidden
    }

    // 监听页面可见性变化，隐藏时中止后续测速任务，显示时可能触发首次测速
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        autoTestGenerationRef.current += 1
        isTestingRef.current = false
        resetAutoDelayState()
      } else {
        // 如果页面恢复可见，且配置了自动测速但还没进行过，则尝试触发
        if (!hasInitialTestRef.current && autoDelayTestOnShow) {
          void doAutoDelayTest().then((started) => {
            if (started) {
              hasInitialTestRef.current = true
            }
          })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const doAutoDelayTest = async (): Promise<boolean> => {
      if (disposed || document.hidden || isTestingRef.current) return false
      
      const latestGroups = groupsRef.current
      if (latestGroups.length === 0) return false

      const delayTargets = getCurrentSelectedDelayTargets(latestGroups)
      if (delayTargets.length === 0) {
        debugLog('[proxy-delay:auto] skip: no stale selected proxy targets')
        return false
      }

      const runId = autoTestGenerationRef.current + 1
      autoTestGenerationRef.current = runId
      isTestingRef.current = true
      debugLog('[proxy-delay:auto] start', latestGroups.map((group) => group.name))

      try {
        const completed = await runDelayTargets(delayTargets, {
          groupsForLoading: latestGroups,
          logScope: 'auto',
          shouldContinue: () => isCurrentAutoTest(runId)
        })

        if (completed) {
          debugLog('[proxy-delay:auto] finished')
        }
        return completed
      } finally {
        if (autoTestGenerationRef.current === runId) {
          isTestingRef.current = false
        }
      }
    }

    // 触发首次测速
    if (!hasInitialTestRef.current && autoDelayTestOnShow) {
      void doAutoDelayTest().then((started) => {
        if (started) {
          hasInitialTestRef.current = true
        }
      })
    }

    // 设置周期测速定时器
    let idleBackfillTimer: NodeJS.Timeout | null = null

    idleBackfillTimer = setTimeout(() => {
      if (disposed || document.hidden || isTestingRef.current || isBackfillingRef.current) return

      const latestGroups = groupsRef.current
      const delayTargets = getAutoBackfillDelayTargets(latestGroups)
      if (delayTargets.length === 0) return

      isBackfillingRef.current = true
      void runDelayTargets(delayTargets, {
        logScope: 'backfill',
        concurrency: Math.min(2, normalizeDelayTestConcurrency(delayTestConcurrencyRef.current))
      }).finally(() => {
        isBackfillingRef.current = false
      })
    }, AUTO_DELAY_IDLE_BACKFILL_MS)

    return () => {
      disposed = true
      autoTestGenerationRef.current += 1
      isTestingRef.current = false
      if (idleBackfillTimer) clearTimeout(idleBackfillTimer)
      isBackfillingRef.current = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      resetAutoDelayState()
    }
  }, [autoDelayGroupSignature, autoDelayTestOnShow, runDelayTargets, setGroupsDelaying])

  const renderItem = useCallback(
    (_index: number, item: FlatItem) => {
      const { groupIndex } = item

      if (item.type === 'header') {
        const group = renderGroups[groupIndex]
        const metrics = group
          ? proxyGroupMetrics.get(group.name) || { currentDelay: -1, liveCount: 0 }
          : undefined
        
        return group ? (
          <ProxyGroupCard
            group={group}
            isOpen={!!isOpen[group.name]}
            toggleOpen={() => toggleOpen(group.name)}
            delaying={!!delaying[group.name]}
            delayVersion={delayVersion}
            currentDelay={metrics?.currentDelay ?? -1}
            liveCount={metrics?.liveCount ?? 0}
            onGroupDelay={() => onGroupDelay(group.name)}
            mutate={mutate}
          />
        ) : (
          <div>Never See This</div>
        )
      } else {
        // Render Proxies Row Chunk
        const { proxies } = item
        const isAuto = proxyCols === 'auto'
        return (
          <ProxyRowChunk
            key={`chunk-${groupIndex}-${proxies[0]?.name}`}
            proxies={proxies}
            group={renderGroups[groupIndex]}
            isAuto={isAuto}
            chunkSize={chunkSize}
            delayVersion={delayVersion}
            mutate={mutate}
            onProxyDelay={onProxyDelay}
            onChangeProxy={onChangeProxy}
            proxyDisplayLayout={proxyDisplayLayout as "hidden" | "single" | "double"}
          />
        )
      }
    },
    [
      renderGroups,
      proxyGroupMetrics,
      isOpen,
      delaying,
      toggleOpen,
      onGroupDelay,
      mutate,
      delayVersion,
      proxyCols,
      chunkSize,
      proxyDisplayLayout,
      onProxyDelay,
      onChangeProxy
    ]
  )

  return (
    <BasePage
      title={t('page.proxies.title')}
      header={

        <div className="flex items-center gap-1 app-nodrag">
          <Button
            size="sm"
            isIconOnly
            variant="light"
            title={t('page.proxies.manageChains')}
            onPress={() => setIsChainModalOpen(true)}
          >
            <MdLink className="text-lg" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            title={t('page.proxies.settings')}
            onPress={() => setIsSettingModalOpen(true)}
          >
            <MdTune className="text-lg" />
          </Button>
        </div>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {isChainModalOpen && <ProxyChainModal onClose={() => setIsChainModalOpen(false)} />}
      {mode === 'direct' ? (
        <EmptyState
          icon={<TbBolt className="!text-[40px] text-teal-500" />}
          title={t('page.proxies.directMode')}
          description={t('page.proxies.directModeDescription')}
        />
      ) : isLoading && (!allGroups || allGroups.length === 0) ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProxyCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : renderGroups.length === 0 ? (
        <EmptyState
          icon={<MdLink className="!text-[40px] text-default-400" />}
          title={t('page.proxies.emptyTitle')}
          description={t('page.proxies.emptyDescription')}
        />
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <Virtuoso
            ref={virtuosoRef}
            data={flatItems}
            itemContent={renderItem}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
