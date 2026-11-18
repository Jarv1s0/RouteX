import { Button, Spinner } from '@heroui/react'
import ProxyProviderItem from '@renderer/components/profiles/proxy-provider-item'
import Viewer from '@renderer/components/resources/viewer'
import {
  getRuntimeConfig,
  mihomoProxyProviders,
  mihomoUpdateProxyProviders
} from '@renderer/utils/mihomo-ipc'
import { getHash } from '@renderer/utils/hash'
import { useEffect, useMemo, useState } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import SettingCard from '@renderer/components/base/base-setting-card'
import { useSearchParams } from 'react-router-dom'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import useSWR from 'swr'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

export const ProviderTabContent: React.FC = () => {
  const { t } = useI18n()
  const { profileConfig } = useProfileConfig()
  const [searchParams, setSearchParams] = useSearchParams()
  const isOpen = searchParams.get('section') === 'providers'
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
    if (!isOpen) return
    void mutateProviders()
  }, [isOpen, mutateProviders])

  const setOpen = (open: boolean): void => {
    const nextParams = new URLSearchParams(searchParams)
    if (open) nextParams.set('section', 'providers')
    else nextParams.delete('section')
    setSearchParams(nextParams, { replace: true })
  }

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
    <>
      <SettingCard
        collapsible
        title={t('page.profiles.providersTitle')}
        description={
          error
            ? t('page.profiles.providersLoadFailed')
            : isLoading
              ? t('page.profiles.providersLoading')
              : t('page.profiles.providerCount', { count: proxyProviders.length })
        }
        expanded={isOpen}
        onExpandedChange={setOpen}
        headerActions={
          isOpen &&
          !isLoading &&
          !error &&
          proxyProviders.length > 0 && (
            <Button
              size="sm"
              isIconOnly
              variant="light"
              className="h-7 w-7 min-w-7 shrink-0 text-default-400 hover:text-foreground"
              title={t('page.profiles.updateAllProviders')}
              aria-label={t('page.profiles.updateAllProviders')}
              isLoading={providerUpdating.some(Boolean)}
              onPress={updateAllProviders}
            >
              <IoMdRefresh className="text-lg" />
            </Button>
          )
        }
      >
        {isLoading ? (
          <div className="flex items-center py-2">
            <Spinner size="sm" label={t('page.profiles.providersLoading')} />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-2 py-1" role="alert">
            <span className="text-sm text-danger">{t('page.profiles.providersLoadFailed')}</span>
            <Button size="sm" variant="light" onPress={() => void mutateProviders()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : proxyProviders.length === 0 ? (
          <p className="py-1 text-xs text-default-500">{t('page.profiles.providersEmpty')}</p>
        ) : (
          <>
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
          </>
        )}
      </SettingCard>
      {showProviderDetails.show && showProviderDetails.path && (
        <Viewer
          title={showProviderDetails.title}
          type={showProviderDetails.type}
          path={showProviderDetails.path}
          privderType={showProviderDetails.privderType}
          onClose={() => setShowProviderDetails((prev) => ({ ...prev, show: false, path: '' }))}
        />
      )}
    </>
  )
}
