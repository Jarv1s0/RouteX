import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardBody, Button, Skeleton, Input, Chip } from '@heroui/react'
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
  IoBusiness,
  IoSearch,
  IoClose
} from 'react-icons/io5'
import {
  fetchIpInfo as fetchIpInfoIpc,
  fetchIpInfoQuery,
  type IpInfoResult
} from '@renderer/utils/tools-ipc'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

const SHOW_IP_STORAGE_KEY = 'routex:tools:showIp'

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

interface IpInfoState {
  ip: string
  query: string | null
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
}

function mapIpInfoResult(data: IpInfoResult): IpInfoState {
  return {
    ip: data.resolvedIp || data.query || '',
    query: data.query || null,
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
  }
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

interface IpInfoPanelProps {
  externalQuery?: { query: string; trigger: number } | null
}

export const IpInfoPanel: React.FC<IpInfoPanelProps> = ({ externalQuery }) => {
  const { t } = useI18n()
  const [showIp, setShowIp] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SHOW_IP_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [queryInput, setQueryInput] = useState('')
  const [activeQuery, setActiveQuery] = useState<string | null>(null)
  const [ipInfo, setIpInfo] = useState<IpInfoState | null>(null)
  const queryIdRef = useRef(0)
  const [ipLoading, setIpLoading] = useState(true)
  const [ipError, setIpError] = useState<string | null>(null)
  const [ipInfoCopied, setIpInfoCopied] = useState(false)
  const [ipOnlyCopied, setIpOnlyCopied] = useState(false)
  const ipInfoCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ipOnlyCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleShowIp = useCallback(() => {
    setShowIp((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SHOW_IP_STORAGE_KEY, String(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  const loadIpInfo = useCallback(
    async (options?: { query?: string | null; force?: boolean }) => {
      const targetQuery = options?.query !== undefined ? options.query : activeQuery
      const force = options?.force ?? false
      const queryId = ++queryIdRef.current
      setIpLoading(true)
      setIpError(null)
      try {
        const data = targetQuery ? await fetchIpInfoQuery(targetQuery) : await fetchIpInfoIpc(force)
        if (queryId !== queryIdRef.current) return
        if (data.status === 'success') {
          setIpInfo(mapIpInfoResult(data))
        } else {
          setIpError(data.message || t('tools.fetchFailed'))
        }
      } catch {
        if (queryId !== queryIdRef.current) return
        setIpError(t('tools.networkError'))
      } finally {
        if (queryId === queryIdRef.current) setIpLoading(false)
      }
    },
    [activeQuery, t]
  )

  const handleSearch = useCallback(
    async (customQuery?: string) => {
      const trimmed = (customQuery ?? queryInput).trim()
      if (!trimmed) {
        setActiveQuery(null)
        await loadIpInfo({ query: null, force: true })
        return
      }
      queryIdRef.current += 1
      setActiveQuery(trimmed)
      setIpInfo(null)
      setIpError(null)
      await loadIpInfo({ query: trimmed, force: true })
    },
    [loadIpInfo, queryInput]
  )

  const handleResetToCurrentIp = useCallback(async () => {
    queryIdRef.current += 1
    setQueryInput('')
    setActiveQuery(null)
    setIpInfo(null)
    setIpError(null)
    await loadIpInfo({ query: null, force: true })
  }, [loadIpInfo])

  const markCopied = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<boolean>>,
      timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
    ) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setter(true)
      timerRef.current = setTimeout(() => {
        setter(false)
        timerRef.current = null
      }, 1200)
    },
    []
  )

  const copyIpInfo = useCallback(async () => {
    if (!ipInfo) return
    const info = `${t('tools.publicIp')}: ${ipInfo.ip}
${t('tools.location')}: ${ipInfo.country} ${ipInfo.city}, ${ipInfo.region}
${t('tools.timezone')}: ${ipInfo.timezone}
ISP: ${ipInfo.isp}
ASN: ${ipInfo.as}`
    await copyText(info)
    markCopied(setIpInfoCopied, ipInfoCopiedTimerRef)
  }, [ipInfo, markCopied, t])

  const copyIpOnly = useCallback(async () => {
    if (!ipInfo?.ip) return
    await copyText(ipInfo.ip)
    markCopied(setIpOnlyCopied, ipOnlyCopiedTimerRef)
  }, [ipInfo, markCopied])

  const loadIpInfoRef = useRef(loadIpInfo)
  loadIpInfoRef.current = loadIpInfo

  useEffect(() => {
    void loadIpInfoRef.current({ query: null, force: false })
  }, [])

  useEffect(() => {
    if (!externalQuery?.query) return
    setQueryInput(externalQuery.query)
    setActiveQuery(externalQuery.query)
    setIpInfo(null)
    setIpError(null)
    void loadIpInfoRef.current({ query: externalQuery.query, force: true })
  }, [externalQuery])

  useEffect(() => {
    return () => {
      if (ipInfoCopiedTimerRef.current) {
        clearTimeout(ipInfoCopiedTimerRef.current)
      }
      if (ipOnlyCopiedTimerRef.current) {
        clearTimeout(ipOnlyCopiedTimerRef.current)
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

  const isIpVisible = showIp || Boolean(activeQuery && ipInfo?.query === activeQuery)

  return (
    <Card
      className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default`}
    >
      <CardBody className="p-2 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/20 p-2">
              <IoLocation className="text-primary text-lg" />
            </div>
            <span className="font-medium">{t('tools.ipInfo')}</span>
            {activeQuery && (
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                onClose={() => void handleResetToCurrentIp()}
                className="h-6"
              >
                {activeQuery}
              </Chip>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-[220px]">
            <Input
              size="sm"
              placeholder={t('tools.ipQueryPlaceholder')}
              value={queryInput}
              onValueChange={setQueryInput}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              className="max-w-xs"
              classNames={CARD_STYLES.GLASS_INPUT}
              endContent={
                queryInput ? (
                  <button
                    type="button"
                    onClick={() => void handleResetToCurrentIp()}
                    className="text-foreground-400 hover:text-foreground-600 transition-colors"
                    title={t('tools.resetToCurrentIp')}
                  >
                    <IoClose className="text-sm" />
                  </button>
                ) : null
              }
            />
            <Button
              size="sm"
              color="primary"
              variant="flat"
              isIconOnly
              isLoading={ipLoading}
              onPress={() => void handleSearch()}
              title={t('common.search')}
            >
              <IoSearch className="text-base" />
            </Button>
            <Button
              size="sm"
              isIconOnly
              variant="light"
              onPress={toggleShowIp}
              title={showIp ? t('tools.hideIp') : t('tools.showIp')}
            >
              {showIp ? <IoEyeOff className="text-base" /> : <IoEye className="text-base" />}
            </Button>
            <Button
              size="sm"
              isIconOnly
              variant={ipInfoCopied ? 'flat' : 'light'}
              color={ipInfoCopied ? 'success' : 'default'}
              onPress={() => void copyIpInfo()}
              title={ipInfoCopied ? t('common.copied') : t('tools.copyFullIpInfo')}
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
              onPress={() => void loadIpInfo({ force: true })}
              title={t('common.refresh')}
            >
              <IoRefresh className="text-base" />
            </Button>
          </div>
        </div>

        {ipLoading && !ipInfo ? (
          <div className="space-y-2.5">
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : ipError ? (
          <div className="text-danger text-sm px-1">{ipError}</div>
        ) : ipInfo ? (
          <div className="grid gap-3 rounded-xl bg-default-50/50 p-2.5 md:grid-cols-[minmax(180px,0.55fr)_minmax(0,1.45fr)] md:items-center">
            <div className="relative min-w-0 pr-9">
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium text-foreground-400">
                  <IoGlobe className="text-primary" />
                  <span>{ipInfo.query ? t('tools.ipInfo') : t('tools.publicIp')}</span>
                </div>
                <div
                  className="max-w-full truncate font-mono text-xl font-bold leading-tight text-foreground-900 select-all"
                  title={isIpVisible ? ipInfo.ip : t('tools.ipHidden')}
                >
                  {isIpVisible ? ipInfo.ip : '•••.•••.•••.•••'}
                </div>
              </div>

              <Button
                size="sm"
                isIconOnly
                variant="light"
                color={ipOnlyCopied ? 'success' : 'default'}
                className="absolute right-0 top-0 h-6 w-6 min-w-6"
                onPress={() => void copyIpOnly()}
                title={ipOnlyCopied ? t('common.copied') : t('tools.copyIp')}
                isDisabled={!ipInfo}
              >
                {ipOnlyCopied ? (
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
