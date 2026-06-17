import { useEffect, useRef } from 'react'
import { debugLog } from '@renderer/utils/logger'
import { getResolvedProxyTarget, getResolvedProxyTargets } from '@renderer/utils/proxy-delay'
import {
  normalizeDelayTestConcurrency,
  shouldAutoDelay,
  type ResolvedDelayTarget,
  type RunDelayTargetsOptions
} from './use-proxy-delay-runner'

const AUTO_DELAY_IDLE_BACKFILL_MS = 5000

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

function getAutoBackfillDelayTargets(groups: ControllerMixedGroup[]): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()
  groups.forEach((group) => {
    getResolvedProxyTargets(group).forEach((target) => {
      pushAutoDelayTarget(targets, target, group.testUrl)
    })
  })
  return Array.from(targets.values())
}

interface UseProxyAutoDelayProps {
  groupsRef: React.MutableRefObject<ControllerMixedGroup[]>
  autoDelayGroupSignature: string
  autoDelayTestOnShow: boolean
  delayTestConcurrencyRef: React.MutableRefObject<number>
  runDelayTargets: (targets: ResolvedDelayTarget[], options: RunDelayTargetsOptions) => Promise<boolean>
  setGroupsDelaying: (targetGroups: ControllerMixedGroup[], value: boolean) => void
}

export function useProxyAutoDelay({
  groupsRef,
  autoDelayGroupSignature,
  autoDelayTestOnShow,
  delayTestConcurrencyRef,
  runDelayTargets,
  setGroupsDelaying
}: UseProxyAutoDelayProps) {
  const hasInitialTestRef = useRef(false)
  const isTestingRef = useRef(false)
  const isBackfillingRef = useRef(false)
  const autoTestGenerationRef = useRef(0)

  useEffect(() => {
    const currentGroups = groupsRef.current
    if (currentGroups.length === 0) return
    if (!autoDelayTestOnShow) return

    let disposed = false
    const resetAutoDelayState = (): void => {
      setGroupsDelaying(groupsRef.current, false)
    }
    const isCurrentAutoTest = (runId: number): boolean => {
      return !disposed && autoTestGenerationRef.current === runId && !document.hidden
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        autoTestGenerationRef.current += 1
        isTestingRef.current = false
        resetAutoDelayState()
      } else {
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
      debugLog(
        '[proxy-delay:auto] start',
        latestGroups.map((group) => group.name)
      )

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

    if (!hasInitialTestRef.current && autoDelayTestOnShow) {
      void doAutoDelayTest().then((started) => {
        if (started) {
          hasInitialTestRef.current = true
        }
      })
    }

    let idleBackfillTimer: NodeJS.Timeout | null = null

    idleBackfillTimer = setTimeout(() => {
      if (disposed || document.hidden || isTestingRef.current || isBackfillingRef.current) return

      const latestGroups = groupsRef.current
      const delayTargets = getAutoBackfillDelayTargets(latestGroups)
      if (delayTargets.length === 0) return

      isBackfillingRef.current = true
      const concurrency = Math.min(2, normalizeDelayTestConcurrency(delayTestConcurrencyRef.current))
      void runDelayTargets(delayTargets, {
        logScope: 'backfill',
        concurrency
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
  }, [autoDelayGroupSignature, autoDelayTestOnShow, runDelayTargets, setGroupsDelaying, delayTestConcurrencyRef, groupsRef])
}
