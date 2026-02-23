import {
  mihomoRuleProviders,
  mihomoUpdateRuleProviders,
  getRuntimeConfig
} from '@renderer/utils/ipc'
import { getHash } from '@renderer/utils/hash'
import Viewer from './viewer'
import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Button, Card, CardBody, Chip } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument } from 'react-icons/md'
import dayjs from 'dayjs'

interface Props {
  hideUpdateAll?: boolean
  onUpdateAllRef?: React.MutableRefObject<(() => void) | null>
}

const RuleProvider: React.FC<Props> = ({ hideUpdateAll = false, onUpdateAllRef }) => {
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    format: '',
    privderType: '',
    behavior: ''
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
              path: provider?.path || `rules/${getHash(provider?.url || '')}`,
              behavior: provider?.behavior || 'domain'
            }))
          }
        } catch {
          setShowDetails((prev) => ({ ...prev, path: '', behavior: '' }))
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
    const handleCoreStarted = (): void => {
      mutate()
    }
    window.electron.ipcRenderer.on('core-started', handleCoreStarted)
    return (): void => {
      window.electron.ipcRenderer.removeListener('core-started', handleCoreStarted)
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
    <div className="space-y-2">
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
              privderType: '',
              behavior: ''
            })
          }
        />
      )}
      {!hideUpdateAll && (
        <div className="flex justify-end px-2">
          <Button
            size="sm"
            color="primary"
            onPress={updateAll}
          >
            更新全部
          </Button>
        </div>
      )}
      <div className="px-2 space-y-1">
        {providers.map((provider, index) => (
          <Card
            key={provider.name}
            shadow="sm"
            radius="sm"
            className="bg-content2 hover:bg-primary/10 transition-colors"
          >
            <CardBody className="py-2 px-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{provider.name}</span>
                  <Chip size="sm" variant="flat" classNames={{ content: "text-xs" }}>
                    {provider.ruleCount}
                  </Chip>
                  <span className="text-foreground-400 text-xs">{provider.format || 'InlineRule'}</span>
                  <span className="text-foreground-400 text-xs">{provider.vehicleType}::{provider.behavior}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-foreground-500 text-xs">{dayjs(provider.updatedAt).fromNow()}</span>
                  {provider.vehicleType !== 'Inline' && (
                    <Button
                      isIconOnly
                      title={provider.vehicleType == 'File' ? '编辑' : '查看'}
                      size="sm"
                      variant="light"
                      onPress={() => {
                        setShowDetails({
                          show: false,
                          privderType: 'rule-providers',
                          path: provider.name,
                          type: provider.vehicleType,
                          title: provider.name,
                          format: provider.format,
                          behavior: provider.behavior
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
                    size="sm"
                    variant="light"
                    onPress={() => {
                      onUpdate(provider.name, index)
                    }}
                  >
                    <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default RuleProvider
