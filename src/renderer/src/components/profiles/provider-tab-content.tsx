import { Button, Spinner } from '@heroui/react'
import ProxyProviderItem from '@renderer/components/profiles/proxy-provider-item'
import Viewer from '@renderer/components/resources/viewer'
import EmptyState from '@renderer/components/base/empty-state'
import {
  getRuntimeConfig,
  mihomoProxyProviders,
  mihomoUpdateProxyProviders
} from '@renderer/utils/mihomo-ipc'
import { getHash } from '@renderer/utils/hash'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoMdRefresh } from 'react-icons/io'
import { IoLayersOutline } from 'react-icons/io5'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import useSWR from 'swr'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

export const ProviderTabContent: React.FC<{ toolbarContainer?: HTMLDivElement | null }> = ({
  toolbarContainer
}) => {
  const { t } = useI18n()
  const { profileConfig } = useProfileConfig()
  const [providerUpdating, setProviderUpdating] = useState<boolean[]>([])
  const [showProviderDetails, setShowProviderDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    privderType: ''
  })
  const {
    data: providersData,
    error,
    isLoading,
    mutate: mutateProviders
  } = useSWR('mihomoProxyProviders', mihomoProxyProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10,
    revalidateIfStale: false,
    revalidateOnMount: true
  })
  const proxyProviders = useMemo(() => {
    if (!providersData) return []
    return Object.values(providersData.providers)
      .filter((provider) => provider.vehicleType !== 'Compatible')
      .sort((a, b) => {
        const order: Record<string, number> = { File: 1, Inline: 2, HTTP: 3 }
        return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
      })
  }, [providersData])

  useEffect(() => {
    void mutateProviders()
  }, [profileConfig, mutateProviders])

  useEffect(() => {
    setProviderUpdating(Array(proxyProviders.length).fill(false))
  }, [proxyProviders.length])

  useEffect(() => {
    if (!showProviderDetails.title) return

    const fetchProviderPath = async (name: string): Promise<void> => {
      try {
        const config = await getRuntimeConfig()
        const provider = config?.['proxy-providers']?.[name] as ProxyProviderConfig
        if (provider) {
          setShowProviderDetails((prev) => ({
            ...prev,
            show: true,
            path: provider.path || `proxies/${getHash(provider.url || '')}`
          }))
        }
      } catch {
        setShowProviderDetails((prev) => ({ ...prev, path: '' }))
      }
    }

    void fetchProviderPath(showProviderDetails.title)
  }, [showProviderDetails.title])

  const onProviderUpdate = async (name: string, index: number): Promise<void> => {
    setProviderUpdating((prev) => {
      const next = [...prev]
      next[index] = true
      return next
    })
    try {
      await mihomoUpdateProxyProviders(name)
      mutateProviders()
    } catch (e) {
      notifyError(t('profiles.providerUpdateFailed', { name, error: String(e) }))
    } finally {
      setProviderUpdating((prev) => {
        const next = [...prev]
        next[index] = false
        return next
      })
    }
  }

  const updateAllProviders = (): void => {
    proxyProviders.forEach((provider, index) => {
      void onProviderUpdate(provider.name, index)
    })
  }

  return (
    <div className="mx-2 mb-4">
      {toolbarContainer &&
        !isLoading &&
        !error &&
        proxyProviders.length > 0 &&
        createPortal(
          <Button
            size="sm"
            variant="flat"
            color="primary"
            className="ml-auto"
            isLoading={providerUpdating.some(Boolean)}
            startContent={!providerUpdating.some(Boolean) && <IoMdRefresh className="text-base" />}
            onPress={updateAllProviders}
          >
            {t('page.profiles.updateAllProviders')}
          </Button>,
          toolbarContainer
        )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="sm" label={t('page.profiles.providersLoading')} />
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-center gap-2 py-12" role="alert">
          <span className="text-sm text-danger">{t('page.profiles.providersLoadFailed')}</span>
          <Button size="sm" variant="light" onPress={() => void mutateProviders()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : proxyProviders.length === 0 ? (
        <div className="h-[calc(100vh-200px)]">
          <EmptyState icon={<IoLayersOutline />} title={t('page.profiles.providersEmpty')} />
        </div>
      ) : (
        <div className="space-y-2">
          {proxyProviders.map((provider, index) => (
            <ProxyProviderItem
              key={provider.name}
              provider={provider}
              index={index}
              updating={providerUpdating[index]}
              onUpdate={() => onProviderUpdate(provider.name, index)}
              onView={() =>
                setShowProviderDetails((prev) => ({
                  ...prev,
                  show: false,
                  path: provider.name,
                  type: provider.vehicleType,
                  title: provider.name,
                  privderType: 'proxy-providers'
                }))
              }
            />
          ))}
        </div>
      )}
      {showProviderDetails.show && showProviderDetails.path && (
        <Viewer
          title={showProviderDetails.title}
          type={showProviderDetails.type}
          path={showProviderDetails.path}
          privderType={showProviderDetails.privderType}
          onClose={() => setShowProviderDetails((prev) => ({ ...prev, show: false, path: '' }))}
        />
      )}
    </div>
  )
}
