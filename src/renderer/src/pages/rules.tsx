import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import RuleProviderItem from '@renderer/components/rules/rule-provider-item'
import GeoData from '@renderer/components/resources/geo-data'
import Viewer from '@renderer/components/resources/viewer'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useMemo, useState } from 'react'
import { Button, Divider, Input, Tab, Tabs } from '@heroui/react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { mihomoRuleProviders, mihomoUpdateRuleProviders, getRuntimeConfig } from '@renderer/utils/ipc'
import { getHash } from '@renderer/utils/hash'
import useSWR from 'swr'

const Rules: React.FC = () => {
  const { rules } = useRules()
  const [filter, setFilter] = useState('')
  const [activeTab, setActiveTab] = useState('rules')
  const [updating, setUpdating] = useState<boolean[]>([])
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    format: '',
    privderType: ''
  })

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
    if (filter === '') return rules.rules
    return rules.rules.filter((rule) => {
      return (
        includesIgnoreCase(rule.payload, filter) ||
        includesIgnoreCase(rule.type, filter) ||
        includesIgnoreCase(rule.proxy, filter)
      )
    })
  }, [rules, filter])

  return (
    <BasePage title="规则">
      <div className="sticky top-0 z-40 bg-background">
        <div className="flex items-center gap-2 p-2">
          <Tabs
            size="md"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
          >
            <Tab key="rules" title="规则列表" />
            <Tab key="providers" title="规则集合" />
            <Tab key="geodata" title="GeoData" />
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
        <Divider />
      </div>
      {activeTab === 'rules' && (
        <div className="h-[calc(100vh-100px)] mt-px">
          <Virtuoso
            data={filteredRules}
            itemContent={(i, rule) => (
              <RuleItem
                index={i}
                type={rule.type}
                payload={rule.payload}
                proxy={rule.proxy}
                size={rule.size}
              />
            )}
          />
        </div>
      )}
      {activeTab === 'providers' && (
        <div className="h-[calc(100vh-100px)] mt-px">
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
        <div className="p-2">
          <GeoData />
        </div>
      )}
    </BasePage>
  )
}

export default Rules
