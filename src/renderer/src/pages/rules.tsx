import BasePage from '@renderer/components/base/base-page'
import QuickRuleEditorModal from '@renderer/components/rules/quick-rule-editor-modal'
import RemoteRuleItem from '@renderer/components/rules/remote-rule-item'
import LocalRuleItem from '@renderer/components/rules/local-rule-item'
import ConfirmModal from '@renderer/components/base/base-confirm'
import GeoData from '@renderer/components/resources/geo-data'
import Viewer from '@renderer/components/resources/viewer'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useMemo, useState, useDeferredValue, useCallback, useRef } from 'react'
import { Button, Chip, Input, Tab, Tabs } from '@heroui/react'
import { IoListOutline, IoCubeOutline, IoGlobeOutline } from 'react-icons/io5'

import { useRules } from '@renderer/hooks/use-rules'
import { useGroups } from '@renderer/hooks/use-groups'
import { includesIgnoreCase } from '@renderer/utils/includes'
import {
  getRuntimeConfig,
  mihomoRuleProviders,
  mihomoToggleRuleDisabled,
  mihomoUpdateRuleProviders
} from '@renderer/utils/mihomo-ipc'
import { getHash } from '@renderer/utils/hash'
import {
  GLOBAL_QUICK_RULES_PROFILE_ID,
  getQuickRules,
  removeQuickRule,
  updateQuickRule
} from '@renderer/utils/quick-rules-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import useSWR from 'swr'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useRulesStore } from '@renderer/store/use-rules-store'
import { resolveFinalProxyNode } from '@renderer/utils/proxy-groups'
import { BUILT_IN_RULE_TARGETS } from '@renderer/utils/rule-targets'

import { useI18n } from '@renderer/i18n'

const normalizeRuleType = (type: string): string => type.replace(/[^a-z0-9]/gi, '').toLowerCase()

const isRemoteRule = (rule: ControllerRulesDetail): boolean => {
  return normalizeRuleType(rule.type) === 'ruleset'
}

const formatQuickRule = (
  rule: Pick<QuickRule, 'type' | 'value' | 'target' | 'noResolve'>
): string => {
  let text = `${rule.type},${rule.value},${rule.target}`
  if (rule.noResolve) {
    text += ',no-resolve'
  }
  return text
}

const runtimeEntryName = (entry: unknown): string | undefined => {
  if (!entry || typeof entry !== 'object') return undefined
  const name = (entry as { name?: unknown }).name
  return typeof name === 'string' && name.trim() ? name : undefined
}

type RuleProviderConfigWithMerge = RuleProviderConfig & {
  '<<'?: RuleProviderConfig | RuleProviderConfig[]
}

const mergeRuleProviderConfig = (
  provider: RuleProviderConfigWithMerge | undefined
): RuleProviderConfig | undefined => {
  if (!provider) return undefined

  const mergeValue = provider['<<']
  const mergedFrom =
    Array.isArray(mergeValue) ? Object.assign({}, ...mergeValue) : mergeValue || {}

  const ownFields = { ...provider }
  delete ownFields['<<']
  return {
    ...mergedFrom,
    ...ownFields
  }
}

const RulesPage: React.FC = () => {
  const { t } = useI18n()
  const { rules, mutate: mutateRules } = useRules()
  const [filter, setFilter] = useState('')
  const deferredFilter = useDeferredValue(filter)
  const [activeTab, setActiveTab] = useState('local')
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [editingQuickRule, setEditingQuickRule] = useState<QuickRule | null>(null)
  const [pendingDeleteQuickRule, setPendingDeleteQuickRule] = useState<QuickRule | null>(null)
  const [isQuickRuleModalOpen, setIsQuickRuleModalOpen] = useState(false)
  const { groups = [] } = useGroups()

  const { disabledRules, setRuleDisabledBatch, toggleRuleDisabled } = useRulesStore()

  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    format: '',
    privderType: '',
    behavior: ''
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
      setRuleDisabledBatch(updates)
    }

    initializedRef.current = true
    prevRulesLength.current = rules.rules.length
  }, [rules, setRuleDisabledBatch]) // Removed disabledRules from dependency

  // 切换规则状态
  const toggleRule = useCallback(
    async (index: number) => {
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
    },
    [disabledRules, toggleRuleDisabled]
  )

  const { data: providersData, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })
  const { data: runtimeConfig } = useSWR('rulesRuntimeConfig', getRuntimeConfig)
  const quickRulesProfileId = GLOBAL_QUICK_RULES_PROFILE_ID
  const { data: quickRulesData, mutate: mutateQuickRules } = useSWR(
    ['quickRules', quickRulesProfileId],
    () => getQuickRules(quickRulesProfileId)
  )

  useEffect(() => {
    const handleQuickRulesUpdated = (): void => {
      mutateQuickRules()
    }
    const offQuickRulesUpdated = onIpc(ON.quickRulesConfigUpdated, handleQuickRulesUpdated)

    return (): void => {
      offQuickRulesUpdated()
    }
  }, [mutateQuickRules])

  const updateAll = (): void => {
    if (!providersData) return
    Object.values(providersData.providers).forEach((provider) => {
      onUpdate(provider.name)
    })
  }

  useEffect(() => {
    if (showDetails.title) {
      const fetchProviderPath = async (name: string): Promise<void> => {
        try {
          const config = await getRuntimeConfig()
          const provider = mergeRuleProviderConfig(
            config?.['rule-providers']?.[name] as RuleProviderConfigWithMerge | undefined
          )
          if (provider) {
            setShowDetails((prev) => ({
              ...prev,
              show: true,
              path: provider?.path || `rules/${getHash(provider?.url || '')}`,
              behavior: provider?.behavior || 'domain'
            }))
          }
        } catch {
          setShowDetails((prev) => ({ ...prev, path: '' }))
        }
      }
      fetchProviderPath(showDetails.title)
    }
  }, [showDetails.title])

  const onUpdate = async (name: string): Promise<void> => {
    setUpdating((prev) => ({ ...prev, [name]: true }))
    try {
      await mihomoUpdateRuleProviders(name)
      mutate()
    } catch (e) {
      new Notification(t('rules.updateProviderFailed', { name, error: String(e) }))
    } finally {
      setUpdating((prev) => ({ ...prev, [name]: false }))
    }
  }

  const filteredIndices = useMemo(() => {
    if (!rules?.rules) return []

    if (deferredFilter === '') {
      return rules.rules.map((_, index) => index)
    }

    return rules.rules.reduce((acc, rule, index) => {
      if (
        includesIgnoreCase(rule.payload, deferredFilter) ||
        includesIgnoreCase(rule.type, deferredFilter) ||
        includesIgnoreCase(rule.proxy, deferredFilter)
      ) {
        acc.push(index)
      }
      return acc
    }, [] as number[])
  }, [rules, deferredFilter])

  const remoteRuleIndices = useMemo(() => {
    const remote: number[] = []

    filteredIndices.forEach((index) => {
      const rule = rules?.rules[index]
      if (!rule) return
      if (isRemoteRule(rule)) {
        remote.push(index)
      }
    })

    return remote
  }, [filteredIndices, rules])

  const filteredQuickRules = useMemo(() => {
    const quickRules = quickRulesData?.rules || []

    if (deferredFilter === '') {
      return quickRules
    }

    return quickRules.filter((rule) => {
      return (
        includesIgnoreCase(rule.type, deferredFilter) ||
        includesIgnoreCase(rule.value, deferredFilter) ||
        includesIgnoreCase(rule.target, deferredFilter) ||
        includesIgnoreCase(rule.source, deferredFilter)
      )
    })
  }, [deferredFilter, quickRulesData])

  const runtimeRuleTargets = useMemo(() => {
    const targets = new Set(BUILT_IN_RULE_TARGETS)
    runtimeConfig?.proxies?.forEach((entry) => {
      const name = runtimeEntryName(entry)
      if (name) targets.add(name)
    })
    runtimeConfig?.['proxy-groups']?.forEach((entry) => {
      const name = runtimeEntryName(entry)
      if (name) targets.add(name)
    })
    return targets
  }, [runtimeConfig])

  const missingRuleTargetIds = useMemo(() => {
    const ids = new Set<string>()
    if (!runtimeConfig) {
      return ids
    }
    for (const rule of quickRulesData?.rules ?? []) {
      if (rule.enabled && !runtimeRuleTargets.has(rule.target)) {
        ids.add(rule.id)
      }
    }
    return ids
  }, [quickRulesData, runtimeConfig, runtimeRuleTargets])

  const remoteItems = useMemo(() => {
    if (!rules?.rules || !providersData) return []

    const firstSeenItems = new Map<
      string,
      {
        rule?: ControllerRulesDetail
        provider?: ControllerRuleProviderDetail
        originalIndex?: number
      }
    >()

    // First pass: rules order (already filtered by deferredFilter if it applies to rules)
    remoteRuleIndices.forEach((index) => {
      const rule = rules.rules[index]
      if (!rule) return

      const providerName = rule.payload
      if (firstSeenItems.has(providerName)) return

      const provider = providersData.providers[providerName]
      firstSeenItems.set(providerName, { rule, provider, originalIndex: index })
    })

    const items = Array.from(firstSeenItems.values())

    // Second pass: unused providers at the bottom
    const allProviders = Object.values(providersData.providers)
    const unusedProviders = allProviders.filter((p) => !firstSeenItems.has(p.name))

    unusedProviders.sort((a, b) => {
      const order: Record<string, number> = { File: 1, Inline: 2, HTTP: 3 }
      return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
    })

    unusedProviders.forEach((provider) => {
      items.push({ provider })
    })

    // Apply filtering to unused providers if deferredFilter exists
    if (deferredFilter !== '') {
      return items.filter((item) => {
        const ruleMatches =
          item.rule &&
          (includesIgnoreCase(item.rule.payload, deferredFilter) ||
            includesIgnoreCase(item.rule.type, deferredFilter) ||
            includesIgnoreCase(item.rule.proxy, deferredFilter))
        const providerMatches =
          item.provider &&
          (includesIgnoreCase(item.provider.name, deferredFilter) ||
            includesIgnoreCase(item.provider.format, deferredFilter))
        return ruleMatches || providerMatches
      })
    }

    return items
  }, [remoteRuleIndices, rules, providersData, deferredFilter])

  const openCreateQuickRule = useCallback(() => {
    setEditingQuickRule(null)
    setIsQuickRuleModalOpen(true)
  }, [])

  const openEditQuickRule = useCallback((rule: QuickRule) => {
    setEditingQuickRule(rule)
    setIsQuickRuleModalOpen(true)
  }, [])

  const closeQuickRuleModal = useCallback(() => {
    setEditingQuickRule(null)
    setIsQuickRuleModalOpen(false)
  }, [])

  const handleQuickRuleSaved = useCallback(async () => {
    await mutateQuickRules()
    setTimeout(() => {
      void mutateRules()
    }, 250)
  }, [mutateQuickRules, mutateRules])

  const handleToggleQuickRule = useCallback(
    async (rule: QuickRule) => {
      try {
        await updateQuickRule(quickRulesProfileId, rule.id, { enabled: !rule.enabled })
        await mutateQuickRules()
        setTimeout(() => {
          void mutateRules()
        }, 250)
      } catch (error) {
        alert(t('rules.toggleFailed', { error: String(error) }))
      }
    },
    [quickRulesProfileId, mutateQuickRules, mutateRules, t]
  )

  const confirmDeleteQuickRule = useCallback(
    async (rule: QuickRule) => {
      try {
        await removeQuickRule(quickRulesProfileId, rule.id)
        await mutateQuickRules()
        setTimeout(() => {
          void mutateRules()
        }, 250)
      } catch (error) {
        alert(t('rules.deleteFailed', { error: String(error) }))
      }
    },
    [quickRulesProfileId, mutateQuickRules, mutateRules, t]
  )

  const handleDeleteQuickRule = useCallback((rule: QuickRule) => {
    setPendingDeleteQuickRule(rule)
  }, [])

  return (
    <BasePage title={t('page.rules.title')}>
      <div className="sticky top-0 z-40 bg-transparent w-full pb-2 px-2 pt-2 pointer-events-none">
        <div
          className={`w-full px-2 py-1.5 flex items-center gap-2 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}
        >
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab
              key="local"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoListOutline className="text-lg" />
                  <span>{t('page.rules.local')}</span>
                </div>
              }
            />

            <Tab
              key="remote"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoCubeOutline className="text-lg" />
                  <span>{t('page.rules.remote')}</span>
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
          {['local', 'remote'].includes(activeTab) && (
            <Input
              variant="flat"
              size="sm"
              value={filter}
              placeholder={t('common.filter')}
              isClearable
              onValueChange={setFilter}
              className="flex-1"
              classNames={CARD_STYLES.GLASS_INPUT}
            />
          )}
          {activeTab === 'local' && (
            <Button size="sm" color="primary" className="ml-auto" onPress={openCreateQuickRule}>
              {t('page.rules.create')}
            </Button>
          )}
          {activeTab === 'remote' && (
            <Button size="sm" color="primary" onPress={updateAll}>
              {t('common.updateAll')}
            </Button>
          )}
        </div>
      </div>
      {activeTab === 'local' && (
        <div className="h-[calc(100vh-100px)] overflow-y-auto">
          {isQuickRuleModalOpen && (
            <QuickRuleEditorModal
              profileId={quickRulesProfileId}
              rule={editingQuickRule}
              onClose={closeQuickRuleModal}
              onSaved={handleQuickRuleSaved}
            />
          )}
          {pendingDeleteQuickRule && (
            <ConfirmModal
              title={t('page.rules.delete')}
              confirmText={t('common.delete')}
              cancelText={t('common.cancel')}
              onChange={(open) => {
                if (!open) setPendingDeleteQuickRule(null)
              }}
              onConfirm={() => confirmDeleteQuickRule(pendingDeleteQuickRule)}
              description={
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-foreground-600">
                    {t('rules.deleteConfirmDescription')}
                  </p>
                  <code className="rounded-2xl border border-danger/20 bg-danger/10 px-3 py-2 font-mono text-sm text-danger">
                    {formatQuickRule(pendingDeleteQuickRule)}
                  </code>
                </div>
              }
            />
          )}

          <div className="w-full px-2 pb-6">
            {quickRulesData?.enabled === false && (
              <div className="mx-2 mb-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-700 dark:text-warning-300">
                <Chip
                  size="sm"
                  variant="flat"
                  color="warning"
                  classNames={{ content: 'text-[10px] font-medium' }}
                >
                  {t('rules.disabledBadge')}
                </Chip>
                <span>{t('rules.disabledDescription')}</span>
              </div>
            )}
            {filteredQuickRules.length > 0 ? (
              <div className="flex flex-col">
                {filteredQuickRules.map((rule, index) => {
                  const targetMissing = missingRuleTargetIds.has(rule.id)
                  const finalNode = resolveFinalProxyNode(groups, rule.target) ?? undefined
                  return (
                    <LocalRuleItem
                      key={rule.id}
                      rule={rule}
                      index={index}
                      targetMissing={targetMissing}
                      finalNode={finalNode}
                      onToggle={handleToggleQuickRule}
                      onEdit={openEditQuickRule}
                      onDelete={handleDeleteQuickRule}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="mx-2 rounded-lg border border-dashed border-default-200/70 bg-background/50 px-4 py-8 text-center text-sm text-foreground-400 dark:border-white/10">
                {deferredFilter ? t('rules.noMatchedLocal') : t('rules.emptyLocal')}
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'remote' && (
        <div className="h-[calc(100vh-100px)]">
          {showDetails.show && (
            <Viewer
              path={showDetails.path}
              type={showDetails.type}
              title={showDetails.title}
              format={showDetails.format}
              privderType={showDetails.privderType}
              behavior={showDetails.behavior}
              onClose={() =>
                setShowDetails({
                  show: false,
                  path: '',
                  type: '',
                  title: '',
                  format: '',
                  privderType: '',
                  behavior: ''
                })
              }
            />
          )}
          <Virtuoso
            data={remoteItems}
            itemContent={(i, item) => {
              const isDisabled =
                item.originalIndex !== undefined
                  ? disabledRules[item.originalIndex] || item.rule?.disabled || false
                  : false

              return (
                <RemoteRuleItem
                  rule={item.rule}
                  provider={item.provider}
                  index={i}
                  enabled={!isDisabled}
                  updating={item.provider ? updating[item.provider.name] || false : false}
                  onToggle={
                    item.originalIndex !== undefined
                      ? () => toggleRule(item.originalIndex!)
                      : undefined
                  }
                  onUpdate={item.provider ? () => onUpdate(item.provider!.name) : undefined}
                  onView={
                    item.provider
                      ? () => {
                          setShowDetails({
                            show: false,
                            privderType: 'rule-providers',
                            path: item.provider!.name,
                            type: item.provider!.vehicleType,
                            title: item.provider!.name,
                            format: item.provider!.format,
                            behavior: item.provider!.behavior
                          })
                        }
                      : undefined
                  }
                />
              )
            }}
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

export default RulesPage
