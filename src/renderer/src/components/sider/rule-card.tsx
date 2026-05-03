import { Button, Tooltip } from '@heroui/react'
import { LuGitBranch, LuRotateCw } from 'react-icons/lu'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import useSWR from 'swr'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import {
  getRuntimeConfig,
  isExpectedMihomoUnavailableError,
  mihomoRuleProviders,
  mihomoUpdateRuleProviders
} from '@renderer/utils/mihomo-ipc'
import { navigateSidebarRoute } from '@renderer/routes'

interface Props {
  iconOnly?: boolean
  compact?: boolean
  className?: string
}

const RULE_CARD_REFRESH_DEBOUNCE_MS = 150
const RULE_CARD_STARTUP_POLL_INTERVAL_MS = 800
const RULE_CARD_STARTUP_POLL_MAX_ATTEMPTS = 6
const RULE_CARD_COUNT_CACHE_KEY = 'routex:rule-card-counts'
const RULE_CARD_IDLE_REFRESH_DELAY_MS = 2000

interface CachedRuleCardCounts {
  providerCount: number
  ruleCount: number
}

interface RuleCardDisplayCounts {
  providerText: string
  ruleText: string
}

function readCachedRuleCardCounts(): CachedRuleCardCounts | null {
  try {
    const raw = window.localStorage.getItem(RULE_CARD_COUNT_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<CachedRuleCardCounts>
    if (
      typeof parsed.providerCount !== 'number' ||
      !Number.isFinite(parsed.providerCount) ||
      typeof parsed.ruleCount !== 'number' ||
      !Number.isFinite(parsed.ruleCount)
    ) {
      return null
    }

    return {
      providerCount: parsed.providerCount,
      ruleCount: parsed.ruleCount
    }
  } catch {
    return null
  }
}

function writeCachedRuleCardCounts(counts: CachedRuleCardCounts): void {
  try {
    window.localStorage.setItem(RULE_CARD_COUNT_CACHE_KEY, JSON.stringify(counts))
  } catch {
    // ignore storage write errors
  }
}

function scheduleIdleTask(task: () => void, delay = 0, timeout = 4000): () => void {
  let idleId: number | null = null
  const win = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number
    cancelIdleCallback?: (handle: number) => void
  }

  const timeoutId = window.setTimeout(() => {
    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(() => task(), { timeout })
      return
    }

    idleId = window.setTimeout(task, 0)
  }, delay)

  return () => {
    window.clearTimeout(timeoutId)
    if (idleId === null) {
      return
    }

    if (typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleId)
      return
    }

    window.clearTimeout(idleId)
  }
}

const RuleCard: React.FC<Props> = (props) => {
  const { iconOnly, compact, className = '' } = props
  const location = useLocation()
  const match = location.pathname.includes('/rules')
  const [updating, setUpdating] = useState(false)
  const [startupCountsReady, setStartupCountsReady] = useState(__ROUTEX_HOST__ !== 'tauri')
  const [ruleCardFetchReady, setRuleCardFetchReady] = useState(
    __ROUTEX_HOST__ !== 'tauri' || match
  )
  const [cachedCounts, setCachedCounts] = useState<CachedRuleCardCounts | null>(() =>
    __ROUTEX_HOST__ === 'tauri' ? readCachedRuleCardCounts() : null
  )
  const retryTimerRef = useRef<number | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const startupPollTimerRef = useRef<number | null>(null)
  const startupPollAttemptsRef = useRef(0)
  const startupStableHitsRef = useRef(0)
  const startupSignatureRef = useRef('')
  const handleNavigate = (): void => {
    navigateSidebarRoute('/rules')
  }

  const clearRetryTimer = useCallback((): void => {
    if (retryTimerRef.current === null) {
      return
    }

    window.clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
  }, [])

  const clearRefreshTimer = useCallback((): void => {
    if (refreshTimerRef.current === null) {
      return
    }

    window.clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = null
  }, [])

  const clearStartupPollTimer = useCallback((): void => {
    if (startupPollTimerRef.current === null) {
      return
    }

    window.clearTimeout(startupPollTimerRef.current)
    startupPollTimerRef.current = null
  }, [])

  const resetStartupCountsState = useCallback((): void => {
    setStartupCountsReady(false)
    startupSignatureRef.current = ''
    startupStableHitsRef.current = 0
    startupPollAttemptsRef.current = 0
    clearStartupPollTimer()
  }, [clearStartupPollTimer])

  const {
    data: providersData,
    error: providersError,
    mutate: mutateProviders
  } = useSWR(
    ruleCardFetchReady ? 'mihomoRuleProviders' : null,
    mihomoRuleProviders,
    {
      shouldRetryOnError: false,
      refreshInterval: match ? 30000 : 0
    }
  )
  const {
    data: runtimeConfig,
    error: runtimeConfigError,
    mutate: mutateRuntimeConfig
  } = useSWR(ruleCardFetchReady ? 'ruleCardRuntimeConfig' : null, getRuntimeConfig, {
    shouldRetryOnError: false,
    refreshInterval: match ? 30000 : 0
  })

  const providerMap = providersData?.providers

  const providerCount = useMemo(() => {
    return providerMap ? Object.keys(providerMap).length : 0
  }, [providerMap])

  const updatableProviderNames = useMemo(() => {
    if (!providerMap) return []
    return Object.entries(providerMap)
      .filter(([, provider]) => provider.vehicleType === 'HTTP')
      .map(([name]) => name)
  }, [providerMap])

  const ruleCount = useMemo(() => {
    const providerRuleCount = providerMap
      ? Object.values(providerMap).reduce((total, provider) => total + (provider.ruleCount || 0), 0)
      : 0
    const manualRuleCount = Array.isArray(runtimeConfig?.rules)
      ? runtimeConfig.rules.length
      : 0
    return providerRuleCount + manualRuleCount
  }, [providerMap, runtimeConfig])

  const countsSignature = useMemo(() => {
    return `${providerCount}:${ruleCount}`
  }, [providerCount, ruleCount])

  const displayCounts = useMemo<RuleCardDisplayCounts>(() => {
    if (startupCountsReady) {
      return {
        providerText: `${providerCount.toLocaleString()} 个规则集`,
        ruleText: `${ruleCount.toLocaleString()} 条规则`
      }
    }

    if (cachedCounts) {
      return {
        providerText: `${cachedCounts.providerCount.toLocaleString()} 个规则集`,
        ruleText: `${cachedCounts.ruleCount.toLocaleString()} 条规则`
      }
    }

    return {
      providerText: '规则集加载中',
      ruleText: '规则加载中'
    }
  }, [cachedCounts, providerCount, ruleCount, startupCountsReady])

  useEffect(() => {
    if (ruleCardFetchReady) {
      return
    }

    if (match) {
      setRuleCardFetchReady(true)
      return
    }

    return scheduleIdleTask(
      () => {
        if (!document.hidden) {
          setRuleCardFetchReady(true)
        }
      },
      RULE_CARD_IDLE_REFRESH_DELAY_MS
    )
  }, [match, ruleCardFetchReady])

  useEffect(() => {
    if (providerCount <= 0 || ruleCount <= 0) {
      return
    }

    const nextCounts = { providerCount, ruleCount }
    setCachedCounts(nextCounts)
    writeCachedRuleCardCounts(nextCounts)
  }, [providerCount, ruleCount])

  const updateAll = useCallback(async (): Promise<void> => {
    if (updating) return

    if (updatableProviderNames.length === 0) return

    setUpdating(true)
    try {
      await Promise.all(updatableProviderNames.map((name) => mihomoUpdateRuleProviders(name)))
      await Promise.all([mutateProviders(), mutateRuntimeConfig()])
    } catch (e) {
      new Notification(`规则集合更新失败\n${e}`)
    } finally {
      setUpdating(false)
    }
  }, [mutateProviders, mutateRuntimeConfig, updatableProviderNames, updating])

  useEffect(() => {
    const refresh = (): void => {
      clearRetryTimer()
      void mutateProviders()
      void mutateRuntimeConfig()
    }

    const scheduleRefresh = (): void => {
      clearRefreshTimer()
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        if (!ruleCardFetchReady) {
          setRuleCardFetchReady(true)
          return
        }
        refresh()
      }, RULE_CARD_REFRESH_DEBOUNCE_MS)
    }

    const handleVisibilityChange = (): void => {
      if (!document.hidden) {
        scheduleRefresh()
      }
    }

    const offCoreStarted = onIpc(ON.coreStarted, scheduleRefresh)
    const offRulesUpdated = onIpc(ON.rulesUpdated, scheduleRefresh)
    const offProfileConfigUpdated = onIpc(ON.profileConfigUpdated, scheduleRefresh)
    const offOverrideConfigUpdated = onIpc(ON.overrideConfigUpdated, scheduleRefresh)
    const offControledConfigUpdated = onIpc(ON.controledMihomoConfigUpdated, scheduleRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return (): void => {
      clearRetryTimer()
      clearRefreshTimer()
      clearStartupPollTimer()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      offCoreStarted()
      offRulesUpdated()
      offProfileConfigUpdated()
      offOverrideConfigUpdated()
      offControledConfigUpdated()
    }
  }, [
    clearRefreshTimer,
    clearRetryTimer,
    clearStartupPollTimer,
    mutateProviders,
    mutateRuntimeConfig,
    ruleCardFetchReady
  ])

  useEffect(() => {
    clearRetryTimer()

    if (
      (!isExpectedMihomoUnavailableError(providersError) &&
        !isExpectedMihomoUnavailableError(runtimeConfigError)) ||
      document.hidden
    ) {
      return
    }

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      void mutateProviders()
      void mutateRuntimeConfig()
    }, 1200)

    return (): void => {
      clearRetryTimer()
    }
  }, [clearRetryTimer, mutateProviders, mutateRuntimeConfig, providersError, runtimeConfigError])

  useEffect(() => {
    if (__ROUTEX_HOST__ !== 'tauri') {
      return
    }

    if (!providerMap || !runtimeConfig) {
      resetStartupCountsState()
      return
    }

    if (startupCountsReady) {
      return
    }

    if (startupSignatureRef.current === countsSignature) {
      startupStableHitsRef.current += 1
    } else {
      startupSignatureRef.current = countsSignature
      startupStableHitsRef.current = 0
    }

    if (startupStableHitsRef.current >= 1) {
      setStartupCountsReady(true)
      clearStartupPollTimer()
      return
    }

    if (startupPollAttemptsRef.current >= RULE_CARD_STARTUP_POLL_MAX_ATTEMPTS) {
      setStartupCountsReady(true)
      clearStartupPollTimer()
      return
    }

    clearStartupPollTimer()
    startupPollTimerRef.current = window.setTimeout(() => {
      startupPollTimerRef.current = null
      startupPollAttemptsRef.current += 1
      void Promise.all([mutateProviders(), mutateRuntimeConfig()])
    }, RULE_CARD_STARTUP_POLL_INTERVAL_MS)

    return (): void => {
      clearStartupPollTimer()
    }
  }, [
    countsSignature,
    mutateProviders,
    mutateRuntimeConfig,
    providerMap,
    resetStartupCountsState,
    runtimeConfig,
    startupCountsReady
  ])

  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="规则" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={handleNavigate}
          >
            <LuGitBranch className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={`rule-card flex min-h-0 flex-col ${compact ? 'justify-between gap-1.5 px-3 py-2' : 'gap-1.5 p-2 px-3'} ${className} rounded-xl cursor-pointer transition-colors group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={handleNavigate}
    >
      <div className="flex items-center justify-between h-7">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuGitBranch
              className={`text-[16px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`}
            />
          </span>
          <h3
            className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}
          >
            路由规则
          </h3>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            isIconOnly
            size="sm"
            className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} min-w-0`}
            variant="light"
            disabled={updating || updatableProviderNames.length === 0}
            onPress={updateAll}
          >
            <LuRotateCw
              className={`${compact ? 'text-[13px]' : 'text-[14px]'} ${updating ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>
      <div
        className={`flex justify-between items-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/70 dark:text-foreground/65 px-0.5`}
      >
        <span>{displayCounts.providerText}</span>
        <span>{displayCounts.ruleText}</span>
      </div>
    </div>
  )
}

export default RuleCard
