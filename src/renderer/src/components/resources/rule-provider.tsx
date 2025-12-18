import {
  mihomoRuleProviders,
  mihomoUpdateRuleProviders,
  getRuntimeConfig
} from '@renderer/utils/ipc'
import { getHash } from '@renderer/utils/hash'
import Viewer from './viewer'
import { Fragment, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Chip } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument } from 'react-icons/md'
import dayjs from 'dayjs'

interface Props {
  compact?: boolean
  hideUpdateAll?: boolean
  onUpdateAllRef?: React.MutableRefObject<(() => void) | null>
}

const RuleProvider: React.FC<Props> = ({ compact = false, hideUpdateAll = false, onUpdateAllRef }) => {
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    format: '',
    privderType: ''
  })
  useEffect(() => {
    if (showDetails.title) {
      const fetchProviderPath = async (name: string): Promise<void> => {
        try {
          const providers = await getRuntimeConfig()
          const provider = providers?.['rule-providers']?.[name] as ProxyProviderConfig
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

  const { data, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  useEffect(() => {
    window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('core-started')
    }
  }, [])

  const providers = useMemo(() => {
    if (!data) return []
    return Object.values(data.providers).sort((a, b) => {
      const order = { File: 1, Inline: 2, HTTP: 3 }
      return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
    })
  }, [data])
  const [updating, setUpdating] = useState(Array(providers.length).fill(false))

  const updateAll = (): void => {
    providers.forEach((provider, index) => {
      onUpdate(provider.name, index)
    })
  }

  useEffect(() => {
    if (onUpdateAllRef) {
      onUpdateAllRef.current = updateAll
    }
  }, [providers, onUpdateAllRef])

  const onUpdate = async (name: string, index: number): Promise<void> => {
    setUpdating((prev) => {
      prev[index] = true
      return [...prev]
    })
    try {
      await mihomoUpdateRuleProviders(name)
      mutate()
    } catch (e) {
      new Notification(`${name} 更新失败\n${e}`)
    } finally {
      setUpdating((prev) => {
        prev[index] = false
        return [...prev]
      })
    }
  }

  if (!providers.length) {
    return null
  }

  return (
    <SettingCard className={compact ? 'mb-0' : ''}>
      <div className={compact ? 'text-sm' : ''}>
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
      {!hideUpdateAll && (
        <SettingItem title="" divider>
          <Button
            size="sm"
            color="primary"
            onPress={updateAll}
          >
            更新全部
          </Button>
        </SettingItem>
      )}
      {providers.map((provider, index) => (
        <Fragment key={provider.name}>
          {compact ? (
            <SettingItem
              title={
                <span className="text-sm flex items-center gap-2">
                  {provider.name}
                  <Chip size="sm">{provider.ruleCount}</Chip>
                  <span className="text-foreground-400">{provider.format || 'InlineRule'}</span>
                </span>
              }
              divider={index !== providers.length - 1}
            >
              <div className="flex h-[32px] leading-[32px] text-foreground-500 text-sm items-center">
                <span className="text-foreground-400 mr-2">{provider.vehicleType}::{provider.behavior}</span>
                <div>{dayjs(provider.updatedAt).fromNow()}</div>
                {provider.format !== 'MrsRule' && provider.vehicleType !== 'Inline' && (
                  <Button
                    isIconOnly
                    title={provider.vehicleType == 'File' ? '编辑' : '查看'}
                    className="ml-2"
                    size="sm"
                    onPress={() => {
                      setShowDetails({
                        show: false,
                        privderType: 'rule-providers',
                        path: provider.name,
                        type: provider.vehicleType,
                        title: provider.name,
                        format: provider.format
                      })
                    }}
                  >
                    {provider.vehicleType == 'File' ? (
                      <MdEditDocument className="text-lg" />
                    ) : (
                      <CgLoadbarDoc className="text-lg" />
                    )}
                  </Button>
                )}
                <Button
                  isIconOnly
                  title="更新"
                  className="ml-2"
                  size="sm"
                  onPress={() => {
                    onUpdate(provider.name, index)
                  }}
                >
                  <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </SettingItem>
          ) : (
            <>
              <SettingItem
                title={<span className="text-sm">{provider.name}</span>}
                actions={
                  <Chip className="ml-2" size="sm">
                    {provider.ruleCount}
                  </Chip>
                }
              >
                <div className="flex h-[32px] leading-[32px] text-foreground-500 text-sm">
                  <div>{dayjs(provider.updatedAt).fromNow()}</div>
                  {provider.format !== 'MrsRule' && provider.vehicleType !== 'Inline' && (
                    <Button
                      isIconOnly
                      title={provider.vehicleType == 'File' ? '编辑' : '查看'}
                      className="ml-2"
                      size="sm"
                      onPress={() => {
                        setShowDetails({
                          show: false,
                          privderType: 'rule-providers',
                          path: provider.name,
                          type: provider.vehicleType,
                          title: provider.name,
                          format: provider.format
                        })
                      }}
                    >
                      {provider.vehicleType == 'File' ? (
                        <MdEditDocument className={`text-lg`} />
                      ) : (
                        <CgLoadbarDoc className={`text-lg`} />
                      )}
                    </Button>
                  )}
                  <Button
                    isIconOnly
                    title="更新"
                    className="ml-2"
                    size="sm"
                    onPress={() => {
                      onUpdate(provider.name, index)
                    }}
                  >
                    <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </SettingItem>
              <SettingItem
                title={<div className="text-foreground-500 text-sm">{provider.format || 'InlineRule'}</div>}
                divider={index !== providers.length - 1}
              >
                <div className="h-[32px] leading-[32px] text-foreground-500 text-sm">
                  {provider.vehicleType}::{provider.behavior}
                </div>
              </SettingItem>
            </>
          )}
        </Fragment>
      ))}
      </div>
    </SettingCard>
  )
}

export default RuleProvider
