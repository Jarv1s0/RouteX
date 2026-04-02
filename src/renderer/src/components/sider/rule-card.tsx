import { Button, Tooltip } from '@heroui/react'
import { LuGitBranch } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import React, { useEffect, useMemo } from 'react'
import { getRuntimeConfig, mihomoRuleProviders } from '@renderer/utils/mihomo-ipc'
import useSWR from 'swr'

interface Props {
  iconOnly?: boolean
}

const RuleCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/rules')
  
  const { data, mutate } = useSWR(
    'ruleCardStats',
    async () => {
      const [providers, runtimeConfig] = await Promise.all([mihomoRuleProviders(), getRuntimeConfig()])
      return { providers, runtimeConfig }
    },
    {
      errorRetryInterval: 200,
      errorRetryCount: 10,
      refreshInterval: 30000
    }
  )

  const ruleCount = useMemo(() => {
    const providerCount = data?.providers?.providers
      ? Object.values(data.providers.providers).reduce(
          (total, provider) => total + (provider.ruleCount || 0),
          0
        )
      : 0
    const manualRuleCount = Array.isArray(data?.runtimeConfig?.rules) ? data.runtimeConfig.rules.length : 0
    return providerCount + manualRuleCount
  }, [data])
  
  useEffect(() => {
    const handleRefresh = (): void => {
      mutate()
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
  }, [mutate])
  
  if (iconOnly) {
    return (
      <div className={`flex justify-center`}>
        <Tooltip content="规则" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => navigate('/rules')}
          >
            <LuGitBranch className="text-[16px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div 
      className={`rule-card flex flex-col p-2 px-3 rounded-xl cursor-pointer transition-all group ${
        match ? CARD_STYLES.SIDEBAR_ACTIVE : CARD_STYLES.SIDEBAR_ITEM
      }`}
      onClick={() => navigate('/rules')}
    >
      <div className="flex items-center justify-between h-7">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <LuGitBranch className={`text-[16px] transition-colors text-default-500 dark:text-default-400 group-hover:text-foreground/80`} />
          </span>
          <h3 className={`text-sm font-semibold transition-colors text-foreground/90 dark:text-foreground/80 group-hover:text-foreground`}>
            路由规则
          </h3>
        </div>
        <div className="flex items-center">
          <span className={`text-xs font-semibold transition-colors text-foreground/50 dark:text-foreground/40 group-hover:text-foreground/70`}>
            {ruleCount > 0 ? ruleCount.toLocaleString() : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default RuleCard
