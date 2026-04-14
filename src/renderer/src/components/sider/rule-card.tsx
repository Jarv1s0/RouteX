import { Button, Tooltip } from '@heroui/react'
import { LuGitBranch, LuRotateCw } from 'react-icons/lu'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { mutate as globalMutate } from 'swr'
import useSWR from 'swr'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import {
  getRuntimeConfig,
  mihomoRuleProviders,
  mihomoUpdateRuleProviders
} from '@renderer/utils/mihomo-ipc'
import { navigateSidebarRoute } from '@renderer/routes'

interface Props {
  iconOnly?: boolean
  compact?: boolean
  className?: string
}

const RuleCard: React.FC<Props> = (props) => {
  const { iconOnly, compact, className = '' } = props
  const location = useLocation()
  const match = location.pathname.includes('/rules')
  const [updating, setUpdating] = useState(false)
  const [shouldLoadStats, setShouldLoadStats] = useState(match)
  const handleNavigate = (): void => {
    navigateSidebarRoute('/rules')
  }

  const { data, mutate } = useSWR(
    shouldLoadStats ? 'ruleCardStats' : null,
    async () => {
      const [providers, runtimeConfig] = await Promise.all([mihomoRuleProviders(), getRuntimeConfig()])
      return { providers, runtimeConfig }
    },
    {
      errorRetryInterval: 200,
      errorRetryCount: 10,
      refreshInterval: match ? 30000 : 0
    }
  )

  useEffect(() => {
    if (match) {
      setShouldLoadStats(true)
      return
    }

    const timer = window.setTimeout(() => {
      setShouldLoadStats(true)
    }, 12000)

    return (): void => {
      window.clearTimeout(timer)
    }
  }, [match])

  const providerMap = data?.providers?.providers

  const providerCount = useMemo(() => {
    return providerMap ? Object.keys(providerMap).length : 0
  }, [providerMap])

  const ruleCount = useMemo(() => {
    const providerRuleCount = providerMap
      ? Object.values(providerMap).reduce((total, provider) => total + (provider.ruleCount || 0), 0)
      : 0
    const manualRuleCount = Array.isArray(data?.runtimeConfig?.rules) ? data.runtimeConfig.rules.length : 0
    return providerRuleCount + manualRuleCount
  }, [data, providerMap])

  const updateAll = async (): Promise<void> => {
    if (updating) return

    const providerNames = providerMap ? Object.keys(providerMap) : []
    if (providerNames.length === 0) return

    setUpdating(true)
    try {
      await Promise.all(providerNames.map((name) => mihomoUpdateRuleProviders(name)))
      await Promise.all([mutate(), globalMutate('mihomoRuleProviders')])
    } catch (e) {
      new Notification(`规则集合更新失败\n${e}`)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    if (!shouldLoadStats || !match) {
      return
    }

    const handleRefresh = (): void => {
      void mutate()
    }

    const offCoreStarted = onIpc(ON.coreStarted, handleRefresh)
    const offRulesUpdated = onIpc(ON.rulesUpdated, handleRefresh)
    const offProfileConfigUpdated = onIpc(ON.profileConfigUpdated, handleRefresh)
    const offOverrideConfigUpdated = onIpc(ON.overrideConfigUpdated, handleRefresh)
    const offControledConfigUpdated = onIpc(ON.controledMihomoConfigUpdated, handleRefresh)

    return (): void => {
      offCoreStarted()
      offRulesUpdated()
      offProfileConfigUpdated()
      offOverrideConfigUpdated()
      offControledConfigUpdated()
    }
  }, [mutate, shouldLoadStats])

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
            <LuGitBranch className={`text-[16px] transition-colors text-default-700 dark:text-default-300 group-hover:text-foreground`} />
          </span>
          <h3 className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>
            路由规则
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button
            isIconOnly
            size="sm"
            className={`${compact ? 'w-5 h-5' : 'w-6 h-6'} min-w-0`}
            variant="light"
            disabled={updating || providerCount === 0}
            onPress={updateAll}
          >
            <LuRotateCw className={`${compact ? 'text-[13px]' : 'text-[14px]'} ${updating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      <div className={`flex justify-between items-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/70 dark:text-foreground/65 px-0.5`}>
        <span>{providerCount.toLocaleString()} 个规则集</span>
        <span>{ruleCount.toLocaleString()} 条规则</span>
      </div>
    </div>
  )
}

export default RuleCard
