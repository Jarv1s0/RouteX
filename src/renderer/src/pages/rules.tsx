import BasePage from '@renderer/components/base/base-page'
import QuickRuleEditorModal from '@renderer/components/rules/quick-rule-editor-modal'
import RemoteRuleItem from '@renderer/components/rules/remote-rule-item'
import GeoData from '@renderer/components/resources/geo-data'
import Viewer from '@renderer/components/resources/viewer'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useMemo, useState, useDeferredValue, useCallback, useRef } from 'react'
import { Button, Card, CardBody, Chip, Input, Tab, Tabs, Switch, Tooltip } from '@heroui/react'
import { IoListOutline, IoCubeOutline, IoGlobeOutline } from 'react-icons/io5'
import { LuFilePenLine, LuTrash2 } from 'react-icons/lu'
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
import { getCurrentProfileItem } from '@renderer/utils/profile-ipc'
import { getQuickRules, removeQuickRule, updateQuickRule } from '@renderer/utils/quick-rules-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import useSWR from 'swr'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useRulesStore } from '@renderer/store/use-rules-store'
import { RulesProvider } from '@renderer/hooks/use-rules'

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

const getProxyColor = (
  proxy: string
): 'danger' | 'success' | 'secondary' | 'primary' | 'warning' | 'default' => {
  if (proxy === 'REJECT') return 'danger'
  if (proxy === 'DIRECT') return 'default'
  return 'secondary'
}

const RulesPage: React.FC = () => {
  const { rules, mutate: mutateRules } = useRules()
  const [filter, setFilter] = useState('')
  const deferredFilter = useDeferredValue(filter)
  const [activeTab, setActiveTab] = useState('local')
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [editingQuickRule, setEditingQuickRule] = useState<QuickRule | null>(null)
  const [isQuickRuleModalOpen, setIsQuickRuleModalOpen] = useState(false)
  const { groups = [] } = useGroups()

  const { disabledRules, setRuleDisabledBatch, toggleRuleDisabled } = useRulesStore()

  // 递归查找最终节点
  const getFinalNode = useCallback(
    (proxyName: string, visited: Set<string> = new Set()): string | null => {
      if (visited.has(proxyName)) return null
      visited.add(proxyName)

      const group = groups.find((g) => g.name === proxyName)
      if (!group || !group.now) return null

      // 检查 now 是否也是一个代理组
      const subGroup = groups.find((g) => g.name === group.now)
      if (subGroup) {
        return getFinalNode(group.now, visited)
      }

      return group.now
    },
    [groups]
  )

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
  const { data: currentProfile, mutate: mutateCurrentProfile } = useSWR(
    'currentProfileItem',
    getCurrentProfileItem
  )
  const currentProfileId = currentProfile?.id || 'default'
  const { data: quickRulesData, mutate: mutateQuickRules } = useSWR(
    ['quickRules', currentProfileId],
    () => getQuickRules(currentProfileId)
  )

  useEffect(() => {
    const handleQuickRulesUpdated = (): void => {
      mutateQuickRules()
    }
    const handleProfileUpdated = (): void => {
      mutateCurrentProfile()
    }

    const offQuickRulesUpdated = onIpc(ON.quickRulesConfigUpdated, handleQuickRulesUpdated)
    const offProfileUpdated = onIpc(ON.profileConfigUpdated, handleProfileUpdated)

    return (): void => {
      offQuickRulesUpdated()
      offProfileUpdated()
    }
  }, [mutateCurrentProfile, mutateQuickRules])

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
          const provider = config?.['rule-providers']?.[name] as ProxyProviderConfig
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
      new Notification(`${name} 更新失败\n${e}`)
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
      const order = { File: 1, Inline: 2, HTTP: 3 }
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
        await updateQuickRule(currentProfileId, rule.id, { enabled: !rule.enabled })
        await mutateQuickRules()
        setTimeout(() => {
          void mutateRules()
        }, 250)
      } catch (error) {
        alert(`切换状态失败: ${error}`)
      }
    },
    [currentProfileId, mutateQuickRules, mutateRules]
  )

  const handleDeleteQuickRule = useCallback(
    async (rule: QuickRule) => {
      const confirmDelete = window.confirm(`确认删除这条本地规则？\n\n${formatQuickRule(rule)}`)
      if (!confirmDelete) return

      try {
        await removeQuickRule(currentProfileId, rule.id)
        await mutateQuickRules()
        setTimeout(() => {
          void mutateRules()
        }, 250)
      } catch (error) {
        alert(`删除本地规则失败: ${error}`)
      }
    },
    [currentProfileId, mutateQuickRules, mutateRules]
  )

  return (
    <BasePage title="规则">
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
                  <span>本地规则</span>
                </div>
              }
            />

            <Tab
              key="remote"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoCubeOutline className="text-lg" />
                  <span>远程规则</span>
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
              placeholder="筛选过滤"
              isClearable
              onValueChange={setFilter}
              className="flex-1"
              classNames={CARD_STYLES.GLASS_INPUT}
            />
          )}
          {activeTab === 'local' && (
            <Button size="sm" color="primary" className="ml-auto" onPress={openCreateQuickRule}>
              新建规则
            </Button>
          )}
          {activeTab === 'remote' && (
            <Button size="sm" color="primary" onPress={updateAll}>
              更新全部
            </Button>
          )}
        </div>
      </div>
      {activeTab === 'local' && (
        <div className="h-[calc(100vh-100px)] overflow-y-auto">
          {isQuickRuleModalOpen && (
            <QuickRuleEditorModal
              profileId={currentProfileId}
              rule={editingQuickRule}
              onClose={closeQuickRuleModal}
              onSaved={handleQuickRuleSaved}
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
                  已停用
                </Chip>
                <span>当前 profile 的本地规则处于全局停用状态，以下规则暂不会注入当前配置。</span>
              </div>
            )}
            {filteredQuickRules.length > 0 ? (
              <div className="flex flex-col">
                {filteredQuickRules.map((rule, index) => (
                  <div key={rule.id} className="w-full pb-2">
                    <Card
                      shadow="sm"
                      radius="lg"
                      className={`border border-default-200/60 bg-default-100/60 backdrop-blur-md dark:border-white/10 dark:bg-default-50/30 hover:-translate-y-0.5 hover:bg-default-200/60 hover:shadow-md dark:hover:bg-default-100/40 transition-all ${!rule.enabled ? 'grayscale' : ''}`}
                    >
                      <CardBody className="w-full py-2 px-3">
                        <div className="flex items-center gap-2">
                          {/* 开关 和 序号 */}
                          <Switch
                            size="sm"
                            isSelected={rule.enabled}
                            onValueChange={() => void handleToggleQuickRule(rule)}
                            classNames={{
                              wrapper: 'h-4 w-8',
                              thumb: 'h-3 w-3'
                            }}
                          />
                          <span
                            className={`w-6 flex-shrink-0 -mr-1 text-xs text-foreground-400 ${!rule.enabled ? 'line-through' : ''}`}
                          >
                            {index + 1}.
                          </span>

                          <div
                            className={`flex min-w-0 flex-1 items-center ${!rule.enabled ? 'opacity-60 grayscale' : ''}`}
                          >
                            {/* 类型 + 名称 + no-resolve */}
                            <div className="flex flex-shrink-0 items-center gap-2 min-w-0 max-w-[65%]">
                              <Chip
                                size="sm"
                                variant="flat"
                                color="default"
                                classNames={{ content: 'text-xs' }}
                                className="flex-shrink-0"
                              >
                                {rule.type}
                              </Chip>
                              <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
                                <span className="truncate text-sm font-medium" title={rule.value}>
                                  {rule.value}
                                </span>
                                {rule.noResolve && (
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color="warning"
                                    classNames={{ content: 'text-[10px] px-1' }}
                                    className="h-5 flex-shrink-0"
                                  >
                                    no-resolve
                                  </Chip>
                                )}
                              </div>
                            </div>

                            {/* 视觉引导线 (Leader Line) */}
                            <div className="mx-3 mt-1 min-w-[20px] flex-1 self-center border-b border-dashed border-default-400/30 dark:border-default-500/30"></div>

                            {/* 路由策略 Proxy Target */}
                            <div className="flex flex-shrink-0 items-center gap-1 overflow-hidden">
                              <Chip
                                size="sm"
                                variant="flat"
                                color={getProxyColor(rule.target)}
                                classNames={{ content: 'text-xs' }}
                                className="max-w-[7rem]"
                              >
                                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                  {rule.target}
                                </span>
                              </Chip>
                              {getFinalNode(rule.target) &&
                                getFinalNode(rule.target) !== rule.target && (
                                  <>
                                    <span className="text-xs text-foreground-300 flex-shrink-0">
                                      →
                                    </span>
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      classNames={{ content: 'text-xs flag-emoji' }}
                                      className="max-w-[8rem] border border-secondary/20 bg-secondary/10 text-secondary flex-shrink-0"
                                    >
                                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                        {getFinalNode(rule.target)}
                                      </span>
                                    </Chip>
                                  </>
                                )}
                            </div>
                          </div>

                          {/* 操作按钮组 */}
                          <div className="ml-2 flex items-center flex-shrink-0 gap-2 pr-1">
                            <Tooltip content="编辑" delay={500}>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                title="编辑规则"
                                aria-label="编辑规则"
                                className="min-w-8 w-8 h-8 text-default-500"
                                onPress={() => openEditQuickRule(rule)}
                              >
                                <LuFilePenLine className="text-base" />
                              </Button>
                            </Tooltip>

                            <Tooltip content="删除" delay={500} color="danger">
                              <Button
                                isIconOnly
                                size="sm"
                                color="danger"
                                variant="light"
                                title="删除规则"
                                aria-label="删除规则"
                                className="min-w-8 w-8 h-8"
                                onPress={() => void handleDeleteQuickRule(rule)}
                              >
                                <LuTrash2 className="text-base" />
                              </Button>
                            </Tooltip>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-2 rounded-lg border border-dashed border-default-200/70 bg-background/50 px-4 py-8 text-center text-sm text-foreground-400 dark:border-white/10">
                {deferredFilter ? '没有匹配的本地规则。' : '暂无本地规则，点击右上角按钮创建。'}
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

const Rules: React.FC = () => {
  return (
    <RulesProvider>
      <RulesPage />
    </RulesProvider>
  )
}

export default Rules
