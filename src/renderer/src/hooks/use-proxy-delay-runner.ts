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

export function shouldAutoDelay(proxy?: ControllerProxiesDetail, retryTimeout = false): boolean {
  if (!proxy) return false

  const latest = proxy.history?.[proxy.history.length - 1]
  if (!latest || (retryTimeout && latest.delay === 0)) return true

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
  mutate: (force?: boolean) => void | Promise<void>
  autoCloseConnection?: boolean
  delayTestConcurrency: number
}

export function useProxyDelayRunner({
  mutate,
  autoCloseConnection,
  delayTestConcurrency
}: UseProxyDelayRunnerProps) {
  const [delaying, setDelaying] = useState<Record<string, number>>({})

  const setGroupsDelaying = useCallback(
    (targetGroups: ControllerMixedGroup[], value: boolean): void => {
      if (targetGroups.length === 0) return
      setDelaying((prev) => ({
        ...prev,
        ...Object.fromEntries(
          targetGroups.map(({ name }) => [name, (prev[name] ?? 0) + (value ? 1 : -1)])
        )
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
        let hasSuccessfulProbe = false
        const tasks = delayTargets.map((target) => async (): Promise<void> => {
          if (options.shouldContinue && !options.shouldContinue()) return

          debugLog(`[proxy-delay:${options.logScope}] test proxy`, target.proxyName)
          await mihomoProxyDelay(target.proxyName, target.testUrl)
            .then((res) => {
              if (options.shouldContinue && !options.shouldContinue()) return
              if (res && typeof res.delay === 'number') {
                hasSuccessfulProbe ||= res.delay > 0
                useGroupsStore.getState().updateProxyDelay(target.proxyName, res.delay)
              }
            })
            .catch((error) => {
              warnLog(`[proxy-delay:${options.logScope}] failed`, target.proxyName, error)
            })
        })

        await runWithConcurrency(
          tasks,
          normalizeDelayTestConcurrency(options.concurrency ?? delayTestConcurrency)
        )
        if (options.shouldContinue && !options.shouldContinue()) return false

        await mutate(true)
        return hasSuccessfulProbe && (options.shouldContinue?.() ?? true)
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
    async (proxy: string, url?: string): Promise<void> => {
      await runDelayTargets([{ proxyName: proxy, testUrl: url }], { logScope: 'single' })
    },
    [runDelayTargets]
  )

  const onGroupDelay = useCallback(
    async (group: ControllerMixedGroup | undefined): Promise<void> => {
      if (!group) return
      setGroupsDelaying([group], true)

      try {
        await mihomoGroupDelay(group.name, group.testUrl)
      } catch (error) {
        warnLog('[proxy-delay:group] failed', group.name, error)
      } finally {
        try {
          await mutate(true)
        } finally {
          setGroupsDelaying([group], false)
        }
      }
    },
    [mutate, setGroupsDelaying]
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
    runDelayTargets,
    onChangeProxy,
    onProxyDelay,
    onGroupDelay,
    delayOpenedGroup
  }
}
