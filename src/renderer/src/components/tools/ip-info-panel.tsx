import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardBody, Button, Skeleton } from '@heroui/react'
import {
  IoLocation,
  IoEyeOff,
  IoEye,
  IoCopy,
  IoCheckmarkCircle,
  IoRefresh,
  IoGlobe,
  IoMap,
  IoTime,
  IoBusiness
} from 'react-icons/io5'
import { fetchIpInfo as fetchIpInfoIpc } from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

const IpInfoMetaItem: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}> = ({ icon, label, value, mono = false }) => (
  <div className="min-w-0">
    <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground-400">
      {icon}
      <span>{label}</span>
    </div>
    <div
      className={`${mono ? 'font-mono ' : ''}truncate text-[13px] font-semibold text-foreground-800`}
      title={value}
    >
      {value}
    </div>
  </div>
)

interface IpInfoPanelProps {
  showIp: boolean
  setShowIp: (show: boolean) => void
}

export const IpInfoPanel: React.FC<IpInfoPanelProps> = ({ showIp, setShowIp }) => {
  const { t } = useI18n()
  const [ipInfo, setIpInfo] = useState<{
    ip: string
    country: string
    countryCode: string
    region: string
    city: string
    isp: string
    org: string
    as: string
    timezone: string
    lat: number
    lon: number
  } | null>(null)
  const [ipLoading, setIpLoading] = useState(true)
  const [ipError, setIpError] = useState<string | null>(null)
  const [ipInfoCopied, setIpInfoCopied] = useState(false)
  const ipInfoCopiedTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchIpInfo = useCallback(async () => {
    setIpLoading(true)
    setIpError(null)
    try {
      const data = await fetchIpInfoIpc()
      if (data.status === 'success') {
        setIpInfo({
          ip: data.query || '',
          country: data.country || '',
          countryCode: data.countryCode || '',
          region: data.regionName || '',
          city: data.city || '',
          isp: data.isp || '',
          org: data.org || '',
          as: data.as || '',
          timezone: data.timezone || '',
          lat: data.lat || 0,
          lon: data.lon || 0
        })
      } else {
        setIpError(data.message || t('tools.fetchFailed'))
      }
    } catch {
      setIpError(t('tools.networkError'))
    } finally {
      setIpLoading(false)
    }
  }, [t])

  const markIpInfoCopied = useCallback(() => {
    if (ipInfoCopiedTimerRef.current) {
      clearTimeout(ipInfoCopiedTimerRef.current)
    }

    setIpInfoCopied(true)
    ipInfoCopiedTimerRef.current = setTimeout(() => {
      setIpInfoCopied(false)
      ipInfoCopiedTimerRef.current = null
    }, 1200)
  }, [])

  const copyIpInfo = useCallback(async () => {
    if (!ipInfo) return
    const info = `${t('tools.publicIp')}: ${ipInfo.ip}
${t('tools.location')}: ${ipInfo.country} ${ipInfo.city}, ${ipInfo.region}
${t('tools.timezone')}: ${ipInfo.timezone}
ISP: ${ipInfo.isp}
ASN: ${ipInfo.as}`

    try {
      await navigator.clipboard.writeText(info)
      markIpInfoCopied()
    } catch {
      // 降级方案
      const textArea = document.createElement('textarea')
      textArea.value = info
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      markIpInfoCopied()
    }
  }, [ipInfo, markIpInfoCopied, t])

  useEffect(() => {
    void fetchIpInfo()
  }, [fetchIpInfo])

  useEffect(() => {
    return () => {
      if (ipInfoCopiedTimerRef.current) {
        clearTimeout(ipInfoCopiedTimerRef.current)
      }
    }
  }, [])

  const ipLocationText = ipInfo
    ? [ipInfo.country, ipInfo.region, ipInfo.city].filter(Boolean).join(' · ') ||
      t('common.unknown')
    : t('common.unknown')
  const ipAsnText = ipInfo?.as || t('common.unknown')
  const ipIspText = ipInfo?.isp || t('common.unknown')
  const ipTimezoneText = ipInfo?.timezone || t('common.unknown')

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default`}
    >
      <CardBody className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/20 p-2">
              <IoLocation className="text-primary text-lg" />
            </div>
            <span className="font-medium">{t('tools.ipInfo')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              isIconOnly
              variant="light"
              onPress={() => setShowIp(!showIp)}
              title={showIp ? t('tools.hideIp') : t('tools.showIp')}
            >
              {showIp ? <IoEyeOff className="text-base" /> : <IoEye className="text-base" />}
            </Button>
            <Button
              size="sm"
              isIconOnly
              variant={ipInfoCopied ? 'flat' : 'light'}
              color={ipInfoCopied ? 'success' : 'default'}
              onPress={copyIpInfo}
              title={ipInfoCopied ? t('common.copied') : t('tools.copyIpInfo')}
              isDisabled={!ipInfo}
            >
              {ipInfoCopied ? (
                <IoCheckmarkCircle className="text-base" />
              ) : (
                <IoCopy className="text-base" />
              )}
            </Button>
            <Button
              size="sm"
              isIconOnly
              variant="light"
              isLoading={ipLoading}
              onPress={fetchIpInfo}
              title={t('common.refresh')}
            >
              <IoRefresh className="text-base" />
            </Button>
          </div>
        </div>

        {ipLoading && !ipInfo ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : ipError ? (
          <div className="text-danger text-sm">{ipError}</div>
        ) : ipInfo ? (
          <div className="grid gap-3 rounded-xl bg-default-50/50 px-3 py-2.5 md:grid-cols-[minmax(180px,0.55fr)_minmax(0,1.45fr)] md:items-center">
            <div className="relative min-w-0 pr-9">
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground-400">
                  <IoGlobe className="text-primary" />
                  <span>{t('tools.publicIp')}</span>
                </div>
                <div
                  className="max-w-full truncate font-mono text-xl font-bold leading-tight text-foreground-900"
                  title={showIp ? ipInfo.ip : t('tools.ipHidden')}
                >
                  {showIp ? ipInfo.ip : '•••.•••.•••.•••'}
                </div>
              </div>

              <Button
                size="sm"
                isIconOnly
                variant="light"
                color={ipInfoCopied ? 'success' : 'default'}
                className="absolute right-0 top-0 h-6 w-6 min-w-6"
                onPress={copyIpInfo}
                title={ipInfoCopied ? t('common.copied') : t('tools.copyFullIpInfo')}
                isDisabled={!ipInfo}
              >
                {ipInfoCopied ? (
                  <IoCheckmarkCircle className="text-xs" />
                ) : (
                  <IoCopy className="text-xs text-foreground-400" />
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-2.5 border-t border-default-200/40 pt-2.5 sm:grid-cols-2 md:border-l md:border-t-0 md:pl-3 md:pt-0">
              <IpInfoMetaItem
                icon={<IoMap className="text-success" />}
                label={t('tools.location')}
                value={ipLocationText}
              />
              <IpInfoMetaItem
                icon={<IoTime className="text-warning" />}
                label={t('tools.timezone')}
                value={ipTimezoneText}
              />
              <IpInfoMetaItem
                icon={<IoBusiness className="text-secondary" />}
                label="ISP"
                value={ipIspText}
              />
              <IpInfoMetaItem
                icon={<IoGlobe className="text-primary" />}
                label="ASN"
                value={ipAsnText}
                mono
              />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
