import { useEffect } from 'react'
import { warnLog } from '@renderer/utils/logger'
import { getResolvedProxyTarget, getResolvedProxyTargets } from '@renderer/utils/proxy-delay'
import {
  normalizeDelayTestConcurrency,
  shouldAutoDelay,
  type ResolvedDelayTarget,
  type RunDelayTargetsOptions
} from './use-proxy-delay-runner'

const AUTO_DELAY_RETRY_MS = 5000
const AUTO_DELAY_MAX_ATTEMPTS = 3
const AUTO_DELAY_IDLE_BACKFILL_MS = 5000

function pushAutoDelayTarget(
  targets: Map<string, ResolvedDelayTarget>,
  proxy: ControllerProxiesDetail | undefined,
  testUrl?: string,
  retryTimeout = false
): void {
  if (!proxy) return
  if (!shouldAutoDelay(proxy, retryTimeout)) return
  if (targets.has(proxy.name)) return

  targets.set(proxy.name, {
    proxyName: proxy.name,
    testUrl
  })
}

function getCurrentSelectedDelayTargets(groups: ControllerMixedGroup[]): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()
  groups.forEach((group) => {
    pushAutoDelayTarget(targets, getResolvedProxyTarget(group), group.testUrl, true)
  })
  return Array.from(targets.values())
}

function getAutoBackfillDelayTargets(
  groups: ControllerMixedGroup[],
  retryTimeout: boolean
): ResolvedDelayTarget[] {
  const targets = new Map<string, ResolvedDelayTarget>()
  groups.forEach((group) => {
    getResolvedProxyTargets(group).forEach((target) => {
      pushAutoDelayTarget(targets, target, group.testUrl, retryTimeout)
    })
  })
  return Array.from(targets.values())
}

interface UseProxyAutoDelayProps {
  groupsRef: React.MutableRefObject<ControllerMixedGroup[]>
  autoDelayGroupSignature: string
  autoDelayTestOnShow: boolean
  delayTestConcurrencyRef: React.MutableRefObject<number>
  runDelayTargets: (
    targets: ResolvedDelayTarget[],
    options: RunDelayTargetsOptions
  ) => Promise<boolean>
}

export function useProxyAutoDelay({
  groupsRef,
  autoDelayGroupSignature,
  autoDelayTestOnShow,
  delayTestConcurrencyRef,
  runDelayTargets
}: UseProxyAutoDelayProps) {
  useEffect(() => {
    if (!autoDelayTestOnShow || groupsRef.current.length === 0) return

    let disposed = false
    let running = false
    let attempts = 0
    let initialCheckDone = false
    let retryBackfillTimeouts = false
    let backfilled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const canRun = (): boolean => !disposed && !document.hidden

    const schedule = (delay: number): void => {
      if (!canRun() || running || backfilled || timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        void run().catch((error) => warnLog('[proxy-delay:auto] failed', error))
      }, delay)
    }

    const run = async (): Promise<void> => {
      if (!canRun() || running || backfilled) return
      running = true
      let nextDelay: number | undefined
      const concurrency = Math.min(
        2,
        normalizeDelayTestConcurrency(delayTestConcurrencyRef.current)
      )

      try {
        if (!initialCheckDone) {
          const groups = groupsRef.current
          const targets = getCurrentSelectedDelayTargets(groups)
          if (targets.length > 0) {
            const succeeded = await runDelayTargets(targets, {
              groupsForLoading: groups,
              logScope: 'auto',
              concurrency,
              shouldContinue: canRun
            })
            if (!canRun()) return
            attempts += 1
            if (!succeeded && attempts < AUTO_DELAY_MAX_ATTEMPTS) {
              nextDelay = AUTO_DELAY_RETRY_MS
              return
            }
            if (!succeeded) {
              backfilled = true
              return
            }
            retryBackfillTimeouts = true
          }
          initialCheckDone = true
          nextDelay = AUTO_DELAY_IDLE_BACKFILL_MS
          return
        }

        const targets = getAutoBackfillDelayTargets(groupsRef.current, retryBackfillTimeouts)
        if (targets.length > 0) {
          await runDelayTargets(targets, {
            logScope: 'backfill',
            concurrency,
            shouldContinue: canRun
          })
        }
        backfilled = canRun()
      } finally {
        running = false
        if (nextDelay !== undefined) schedule(nextDelay)
      }
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        clearTimeout(timer)
        timer = undefined
      } else {
        schedule(initialCheckDone ? AUTO_DELAY_IDLE_BACKFILL_MS : 0)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    void run().catch((error) => warnLog('[proxy-delay:auto] failed', error))

    return () => {
      disposed = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    autoDelayGroupSignature,
    autoDelayTestOnShow,
    runDelayTargets,
    delayTestConcurrencyRef,
    groupsRef
  ])
}
