import { useCallback, useState } from 'react'
import { debugLog, warnLog } from '@renderer/utils/logger'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  mihomoProxyDelay
} from '@renderer/utils/mihomo-ipc'
import { useGroupsStore } from '@renderer/store/use-groups-store'
import { getResolvedProxyTarget } from '@renderer/utils/proxy-delay'

const DEFAULT_DELAY_TEST_CONCURRENCY = 4
const MAX_DELAY_TEST_CONCURRENCY = 8
const DELAY_TEST_MUTATE_BATCH_MS = 700
const AUTO_DELAY_TTL_MS = 5 * 60 * 1000

export type ResolvedDelayTarget = {
  proxyName: string
  testUrl?: string
}

export type RunDelayTargetsOptions = {
  groupsForLoading?: ControllerMixedGroup[]
  logScope: string
  concurrency?: number
  shouldContinue?: () => boolean
}

export function normalizeDelayTestConcurrency(value?: number): number {
  const parsed = Number.parseInt(String(value ?? DEFAULT_DELAY_TEST_CONCURRENCY), 10)
  if (!Number.isFinite(parsed)) return DEFAULT_DELAY_TEST_CONCURRENCY
  return Math.min(MAX_DELAY_TEST_CONCURRENCY, Math.max(1, parsed))
}

export function shouldAutoDelay(proxy?: ControllerProxiesDetail): boolean {
  if (!proxy) return false

  const latest = proxy.history?.[proxy.history.length - 1]
  if (!latest) return true

  const time = Date.parse(latest.time)
  if (!Number.isFinite(time)) return true

  return Date.now() - time > AUTO_DELAY_TTL_MS
}

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

export function createMutateBatcher(mutate: () => void | Promise<void>, waitMs: number) {
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

export function getDirectGroupDelayTargets(group: ControllerMixedGroup): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()

  for (const proxy of group.all || []) {
    const target = 'now' in proxy ? getResolvedProxyTarget(proxy) : proxy
    if (target && shouldAutoDelay(target) && !targets.has(target.name)) {
      targets.set(target.name, {
        proxyName: target.name,
        testUrl: group.testUrl
      })
    }
  }

  return Array.from(targets.values())
}

interface UseProxyDelayRunnerProps {
  mutate: () => void
  autoCloseConnection?: boolean
  delayTestConcurrency: number
}

export function useProxyDelayRunner({
  mutate,
  autoCloseConnection,
  delayTestConcurrency
}: UseProxyDelayRunnerProps) {
  const [delaying, setDelaying] = useState<Record<string, boolean>>({})

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

  const runDelayTargets = useCallback(
    async (
      delayTargets: ResolvedDelayTarget[],
      options: RunDelayTargetsOptions
    ): Promise<boolean> => {
      if (delayTargets.length === 0) return false
      if (options.shouldContinue && !options.shouldContinue()) return false

      const loadingGroups = options.groupsForLoading || []
      setGroupsDelaying(loadingGroups, true)

      try {
        const tasks = delayTargets.map((target) => async (): Promise<void> => {
          if (options.shouldContinue && !options.shouldContinue()) return

          debugLog(`[proxy-delay:${options.logScope}] test proxy`, target.proxyName)
          await mihomoProxyDelay(target.proxyName, target.testUrl)
            .then((res) => {
              if (res && typeof res.delay === 'number') {
                useGroupsStore.getState().updateProxyDelay(target.proxyName, res.delay)
              }
            })
            .catch((error) => {
              warnLog(`[proxy-delay:${options.logScope}] failed`, target.proxyName, error)
            })

          if (options.shouldContinue && !options.shouldContinue()) return
        })

        await runWithConcurrency(
          tasks,
          normalizeDelayTestConcurrency(options.concurrency ?? delayTestConcurrency)
        )
        if (options.shouldContinue && !options.shouldContinue()) return false

        mutate()
        return options.shouldContinue ? options.shouldContinue() : true
      } finally {
        setGroupsDelaying(loadingGroups, false)
      }
    },
    [setGroupsDelaying, delayTestConcurrency, mutate]
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
    async (group: ControllerMixedGroup | undefined): Promise<void> => {
      if (!group) return
      setDelaying((prev) => ({ ...prev, [group.name]: true }))
      const mutateBatcher = createMutateBatcher(mutate, DELAY_TEST_MUTATE_BATCH_MS)

      try {
        await mihomoGroupDelay(group.name, group.testUrl)
        mutateBatcher.schedule()
        await mutateBatcher.flush()
      } catch (error) {
        warnLog('[proxy-delay:group] failed', group.name, error)
      } finally {
        mutateBatcher.cancel()
        setDelaying((prev) => ({ ...prev, [group.name]: false }))
      }
    },
    [mutate]
  )

  const delayOpenedGroup = useCallback(
    async (group: ControllerMixedGroup | undefined): Promise<void> => {
      if (!group) return
      const delayTargets = getDirectGroupDelayTargets(group)
      await runDelayTargets(delayTargets, {
        groupsForLoading: [group],
        logScope: 'open-group'
      })
    },
    [runDelayTargets]
  )

  return {
    delaying,
    setGroupsDelaying,
    runDelayTargets,
    onChangeProxy,
    onProxyDelay,
    onGroupDelay,
    delayOpenedGroup
  }
}
