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
import { IpCheckerPanel } from './ip-checker-panel'

const PROBE_NAME_MAP: Record<string, string> = {
  ipip: 'IPIP.net',
  ipsb: 'IP.SB',
  ifconfig: 'ifconfig.co'
}

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
  const [probeResults, setProbeResults] = useState<
    Record<string, { ip: string; location: string; isp: string }>
  >({})

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
    let info = `${t('tools.nativeIp')}: ${ipInfo.ip}
${t('tools.location')}: ${ipInfo.country} ${ipInfo.city}, ${ipInfo.region}
${t('tools.timezone')}: ${ipInfo.timezone}
ISP: ${ipInfo.isp}
ASN: ${ipInfo.as}`

    if (Object.keys(probeResults).length > 0) {
      info += `\n\n--- ${t('tools.probeResults')} ---\n`
      Object.entries(probeResults).forEach(([id, res]) => {
        info += `[${PROBE_NAME_MAP[id] || id}] IP: ${res.ip} | ${t('tools.probeBelongsTo')}: ${res.location} ${res.isp}\n`
      })
    }

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
  }, [ipInfo, markIpInfoCopied, probeResults, t])

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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/20">
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
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
        ) : ipError ? (
          <div className="text-danger text-sm">{ipError}</div>
        ) : ipInfo ? (
          <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)]">
            <div className="h-full rounded-xl border border-default-200/40 bg-default-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <IoGlobe className="text-lg" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground-400">
                        {t('tools.publicIp')}
                      </div>
                    </div>
                  </div>
                  <div
                    className="max-w-full truncate font-mono text-2xl font-bold leading-tight text-foreground-900"
                    title={showIp ? ipInfo.ip : t('tools.ipHidden')}
                  >
                    {showIp ? ipInfo.ip : '•••.•••.•••.•••'}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="flat"
                  color={ipInfoCopied ? 'success' : 'primary'}
                  onPress={copyIpInfo}
                  title={ipInfoCopied ? t('common.copied') : t('tools.copyFullIpInfo')}
                  isDisabled={!ipInfo}
                  startContent={
                    ipInfoCopied ? (
                      <IoCheckmarkCircle className="text-sm" />
                    ) : (
                      <IoCopy className="text-sm" />
                    )
                  }
                >
                  {ipInfoCopied ? t('common.copied') : t('common.copy')}
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg border border-default-200/40 bg-content1/60 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-foreground-400">
                    <IoMap className="text-success" />
                    <span>{t('tools.location')}</span>
                  </div>
                  <div className="truncate text-sm font-semibold" title={ipLocationText}>
                    {ipLocationText}
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-default-200/40 bg-content1/60 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-foreground-400">
                    <IoTime className="text-warning" />
                    <span>{t('tools.timezone')}</span>
                  </div>
                  <div className="truncate text-sm font-semibold" title={ipTimezoneText}>
                    {ipTimezoneText}
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-default-200/40 bg-content1/60 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-foreground-400">
                    <IoBusiness className="text-secondary" />
                    <span>ISP</span>
                  </div>
                  <div className="truncate text-sm font-semibold" title={ipIspText}>
                    {ipIspText}
                  </div>
                </div>

                <div className="min-w-0 rounded-lg border border-default-200/40 bg-content1/60 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs text-foreground-400">
                    <IoGlobe className="text-primary" />
                    <span>ASN</span>
                  </div>
                  <div className="truncate font-mono text-sm font-semibold" title={ipAsnText}>
                    {ipAsnText}
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-0 h-full">
              <IpCheckerPanel showIp={showIp} onResultsChange={setProbeResults} enabled />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
