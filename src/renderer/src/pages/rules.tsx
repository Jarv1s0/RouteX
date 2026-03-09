import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import RuleProviderItem from '@renderer/components/rules/rule-provider-item'
import GeoData from '@renderer/components/resources/geo-data'
import Viewer from '@renderer/components/resources/viewer'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useMemo, useState, useDeferredValue, useCallback, useRef } from 'react'
import { Button, Input, Tab, Tabs } from '@heroui/react'
import { IoListOutline, IoCubeOutline, IoGlobeOutline } from 'react-icons/io5'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { mihomoRuleProviders, mihomoUpdateRuleProviders, getRuntimeConfig, mihomoToggleRuleDisabled } from '@renderer/utils/ipc'
import { getHash } from '@renderer/utils/hash'
import useSWR from 'swr'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useRulesStore } from '@renderer/store/use-rules-store'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [filter, setFilter] = useState('')
  const deferredFilter = useDeferredValue(filter)
  const [activeTab, setActiveTab] = useState('rules')
  const [updating, setUpdating] = useState<boolean[]>([])
  
  const { disabledRules, setRuleDisabled, toggleRuleDisabled } = useRulesStore()
  
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    format: '',
    privderType: ''
  })

  // Optimize: Use ref to track initialization to prevent infinite loops
  const initializedRef = useRef(false)
  const prevRulesLength = useRef(0)

  // Sync disabled state from rules to store (run once when rules are loaded)
  useEffect(() => {
    if (!rules?.rules) return

    // Only run if rules length changed (new rules loaded) or not initialized
    if (initializedRef.current && rules.rules.length === prevRulesLength.current) {
        return
    }

    const updates: Record<number, boolean> = {}
    let hasUpdates = false

    rules.rules.forEach((rule, index) => {
      // If API returns disabled and local store doesn't have it, sync to store
      if (rule.disabled && disabledRules[index] === undefined) {
        updates[index] = true
        hasUpdates = true
      }
    })

    if (hasUpdates) {
       // Batch update by merging into current state
       // We need to access the store's setter carefully. 
       // Since the store's `setRuleDisabled` only sets one, we should actually add a batch action to the store 
       // or just iterate. Iterating here is fine if we don't depend on `disabledRules` in the effect.
       // But better to avoid N re-renders. 
       // For now, simpler fix: iterate but ensure effect dependency doesn't include disabledRules.
       Object.entries(updates).forEach(([index, disabled]) => {
           setRuleDisabled(Number(index), disabled)
       })
    }
    
    initializedRef.current = true
    prevRulesLength.current = rules.rules.length
  }, [rules, setRuleDisabled]) // Removed disabledRules from dependency

  // 切换规则状态
  const toggleRule = useCallback(async (index: number) => {
    const currentDisabled = disabledRules[index] || false
    const newDisabled = !currentDisabled
    
    // 乐观更新 UI
    toggleRuleDisabled(index)
    
    try {
      await mihomoToggleRuleDisabled({ [index]: newDisabled })
      // 不刷新规则列表，因为 mihomo 不会在 rules API 中返回 disabled 状态
    } catch (error) {
      // 回滚状态
      console.error('Failed to toggle rule:', error)
      toggleRuleDisabled(index) // 反向切换回滚
    }
  }, [disabledRules, toggleRuleDisabled])

  const { data: providersData, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  const providers = useMemo(() => {
    if (!providersData) return []
    return Object.values(providersData.providers).sort((a, b) => {
      const order = { File: 1, Inline: 2, HTTP: 3 }
      return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
    })
  }, [providersData])

  useEffect(() => {
    setUpdating(Array(providers.length).fill(false))
  }, [providers.length])

  useEffect(() => {
    if (showDetails.title) {
      const fetchProviderPath = async (name: string): Promise<void> => {
        try {
          const config = await getRuntimeConfig()
          const provider = config?.['rule-providers']?.[name] as ProxyProviderConfig
          if (provider) {
            setShowDetails((prev) => ({
              ...prev,
              show: true,
              path: provider?.path || `rules/${getHash(provider?.url || '')}`
            }))
          }
        } catch {
          setShowDetails((prev) => ({ ...prev, path: '' }))
        }
      }
      fetchProviderPath(showDetails.title)
    }
  }, [showDetails.title])

  const onUpdate = async (name: string, index: number): Promise<void> => {
    setUpdating((prev) => {
      const next = [...prev]
      next[index] = true
      return next
    })
    try {
      await mihomoUpdateRuleProviders(name)
      mutate()
    } catch (e) {
      new Notification(`${name} 更新失败\n${e}`)
    } finally {
      setUpdating((prev) => {
        const next = [...prev]
        next[index] = false
        return next
      })
    }
  }

  const updateAll = (): void => {
    providers.forEach((provider, index) => {
      onUpdate(provider.name, index)
    })
  }

  const filteredRules = useMemo(() => {
    if (!rules) return []
    if (deferredFilter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, deferredFilter) ||
        includesIgnoreCase(rule.type, deferredFilter) ||
        includesIgnoreCase(rule.proxy, deferredFilter)
      )
    })
  }, [rules, deferredFilter])

  return (
    <BasePage title="规则">
      <div className="sticky top-0 z-40 bg-transparent w-full pb-2 px-2 pt-2 pointer-events-none">
        <div className={`w-full px-2 py-1.5 flex items-center gap-2 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}>
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab
              key="rules"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoListOutline className="text-lg" />
                  <span>规则列表</span>
                </div>
              }
            />

            <Tab
              key="providers"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoCubeOutline className="text-lg" />
                  <span>规则集合</span>
                </div>
              }
            />

            <Tab
              key="geodata"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoGlobeOutline className="text-lg" />
                  <span>GeoData</span>
                </div>
              }
            />
          </Tabs>
          {activeTab === 'rules' && (
            <Input
              variant="flat"
              size="sm"
              value={filter}
              placeholder="筛选过滤"
              isClearable
              onValueChange={setFilter}
              className="flex-1"
              classNames={CARD_STYLES.GLASS_INPUT}
            />
          )}
          {activeTab === 'providers' && (
            <Button
              size="sm"
              color="primary"
              className="ml-auto"
              onPress={updateAll}
            >
              更新全部
            </Button>
          )}
        </div>
      </div>
      {activeTab === 'rules' && (
        <div className="h-[calc(100vh-100px)]">
          <Virtuoso
            data={filteredRules}
            itemContent={(i, rule) => {
              // 使用原始索引而不是过滤后的索引
              const originalIndex = rules?.rules?.findIndex(
                r => r.type === rule.type && r.payload === rule.payload && r.proxy === rule.proxy
              ) ?? i
              const isDisabled = disabledRules[originalIndex] || rule.disabled || false
              return (
                <RuleItem
                  index={i}
                  type={rule.type}
                  payload={rule.payload}
                  proxy={rule.proxy}
                  size={rule.size}
                  enabled={!isDisabled}
                  onToggle={() => toggleRule(originalIndex)}
                />
              )
            }}
          />
        </div>
      )}
      {activeTab === 'providers' && (
        <div className="h-[calc(100vh-100px)]">
          {showDetails.show && (
            <Viewer
              path={showDetails.path}
              type={showDetails.type}
              title={showDetails.title}
              format={showDetails.format}
              privderType={showDetails.privderType}
              onClose={() =>
                setShowDetails({
                  show: false,
                  path: '',
                  type: '',
                  title: '',
                  format: '',
                  privderType: ''
                })
              }
            />
          )}
          <Virtuoso
            data={providers}
            itemContent={(i, provider) => (
              <RuleProviderItem
                provider={provider}
                index={i}
                updating={updating[i] || false}
                onUpdate={() => onUpdate(provider.name, i)}
                onView={() => {
                  setShowDetails({
                    show: false,
                    privderType: 'rule-providers',
                    path: provider.name,
                    type: provider.vehicleType,
                    title: provider.name,
                    format: provider.format
                  })
                }}
              />
            )}
          />
        </div>
      )}
      {activeTab === 'geodata' && (
        <div className="px-2">
          <GeoData />
        </div>
      )}
    </BasePage>
  )
}

export default Rules
