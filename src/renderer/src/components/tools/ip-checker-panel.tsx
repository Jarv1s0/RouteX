import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Chip, Skeleton } from '@heroui/react'
import { IoAlertCircle, IoCheckmarkCircle, IoCloseCircle, IoCopy, IoRefresh } from 'react-icons/io5'
import * as isIp from 'is-ip'
import { httpGet } from '@renderer/utils/tools-ipc'
import { translate, useI18n } from '@renderer/i18n'

interface ProviderResult {
  ip: string
  location: string
  isp: string
  latency?: number
}

interface IpProvider {
  id: string
  name: string
  type: 'domestic' | 'international'
  check: () => Promise<ProviderResult>
}

type ProviderState =
  | { status: 'loading' }
  | { status: 'success'; data: ProviderResult }
  | { status: 'invalid'; data: ProviderResult; error: string }
  | { status: 'error'; error: string }

const providers: IpProvider[] = [
  {
    id: 'ipip',
    name: 'IPIP.net',
    type: 'domestic',
    check: async () => {
      const start = Date.now()
      const res = await httpGet('https://myip.ipip.net/json', 5000)
      const parsed = JSON.parse(res.data)
      const data = parsed.data || {}
      return {
        ip: data.ip || '',
        location: (data.location || []).filter(Boolean).slice(0, 3).join(' '),
        isp: (data.location || []).length >= 4 ? data.location.slice(-1)[0] : '',
        latency: Date.now() - start
      }
    }
  },
  {
    id: 'ipsb',
    name: 'IP.SB',
    type: 'international',
    check: async () => {
      const start = Date.now()
      const res = await httpGet('https://api.ip.sb/geoip', 5000)
      const data = JSON.parse(res.data)
      return {
        ip: data.ip || '',
        location: [data.country_code, data.region, data.city].filter(Boolean).join(' '),
        isp: data.organization || '',
        latency: Date.now() - start
      }
    }
  },
  {
    id: 'ifconfig',
    name: 'ifconfig.co',
    type: 'international',
    check: async () => {
      const start = Date.now()
      const res = await httpGet('https://ifconfig.co/json', 5000)
      const data = JSON.parse(res.data)
      return {
        ip: data.ip || '',
        location: [data.country_iso, data.country, data.city].filter(Boolean).join(' '),
        isp: data.asn_org || data.asn || '',
        latency: Date.now() - start
      }
    }
  }
]

export interface IpCheckerPanelProps {
  showIp?: boolean
  onResultsChange?: (results: Record<string, ProviderResult>) => void
  enabled?: boolean
}

const isValidIp = (value: string): boolean => {
  const ip = value.trim()
  return isIp.isIPv4(ip) || isIp.isIPv6(ip)
}

const getReadableError = (error: string): string => {
  const message = error.toLowerCase()

  if (message.includes('timeout') || message.includes('timed out') || message.includes('超时')) {
    return translate('tools.ipChecker.timeout')
  }

  if (message.includes('json') || message.includes('parse') || message.includes('解析')) {
    return translate('tools.ipChecker.parseFailed')
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('网络')) {
    return translate('tools.ipChecker.networkFailed')
  }

  if (message.includes('http')) {
    return translate('tools.ipChecker.httpFailed')
  }

  return error ? translate('tools.ipChecker.unknownReason') : translate('tools.ipChecker.noErrorDetail')
}

export const IpCheckerPanel: React.FC<IpCheckerPanelProps> = ({
  showIp = true,
  onResultsChange,
  enabled = true
}) => {
  const { t } = useI18n()
  const [providerResults, setProviderResults] = useState<Record<string, ProviderState>>({})
  const [copiedProviderId, setCopiedProviderId] = useState<string | null>(null)
  const copiedProviderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProvider = useCallback(async (provider: IpProvider) => {
    setProviderResults((prev) => ({
      ...prev,
      [provider.id]: { status: 'loading' }
    }))

    try {
      const result = await provider.check()
      const normalizedResult = {
        ...result,
        ip: result.ip?.trim() || ''
      }
      setProviderResults((prev) => ({
        ...prev,
        [provider.id]: isValidIp(normalizedResult.ip)
          ? { status: 'success', data: normalizedResult }
          : { status: 'invalid', data: normalizedResult, error: t('tools.ipChecker.noValidIp') }
      }))
    } catch (e) {
      setProviderResults((prev) => ({
        ...prev,
        [provider.id]: { status: 'error', error: e instanceof Error ? e.message : String(e) }
      }))
    }
  }, [t])

  const fetchProviders = useCallback(() => {
    providers.forEach((provider) => {
      void fetchProvider(provider)
    })
  }, [fetchProvider])

  const markProviderCopied = useCallback((providerId: string) => {
    if (copiedProviderTimerRef.current) {
      clearTimeout(copiedProviderTimerRef.current)
    }

    setCopiedProviderId(providerId)
    copiedProviderTimerRef.current = setTimeout(() => {
      setCopiedProviderId(null)
      copiedProviderTimerRef.current = null
    }, 1200)
  }, [])

  const copyProviderIp = useCallback(
    async (providerId: string, ip: string) => {
      try {
        await navigator.clipboard.writeText(ip)
        markProviderCopied(providerId)
      } catch {
        const textArea = document.createElement('textarea')
        textArea.value = ip
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        markProviderCopied(providerId)
      }
    },
    [markProviderCopied]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    fetchProviders()
  }, [enabled, fetchProviders])

  useEffect(() => {
    if (onResultsChange) {
      const results: Record<string, ProviderResult> = {}
      let hasData = false
      Object.entries(providerResults).forEach(([key, value]) => {
        if (value.status === 'success' && value.data) {
          results[key] = value.data
          hasData = true
        }
      })
      if (hasData) {
        onResultsChange(results)
      }
    }
  }, [providerResults, onResultsChange])

  useEffect(() => {
    return () => {
      if (copiedProviderTimerRef.current) {
        clearTimeout(copiedProviderTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-default-200/40 bg-default-50/50">
      <div className="grid grid-cols-[minmax(112px,0.9fr)_72px_minmax(128px,1fr)_minmax(92px,0.7fr)] items-center gap-3 border-b border-default-200/50 px-3 py-2 text-[11px] font-medium text-foreground-400">
        <div>{t('tools.ipChecker.source')}</div>
        <div>{t('tools.ipChecker.type')}</div>
        <div>{t('tools.ipChecker.result')}</div>
        <div className="text-right">{t('tools.ipChecker.latencyAction')}</div>
      </div>
      {providers.map((provider) => {
        const state = providerResults[provider.id]
        return (
          <div
            key={provider.id}
            className="grid min-h-[58px] flex-1 grid-cols-[minmax(112px,0.9fr)_72px_minmax(128px,1fr)_minmax(92px,0.7fr)] items-center gap-3 border-b border-default-200/30 px-3 py-2 last:border-b-0 hover:bg-default-100/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={
                  state?.status === 'success'
                    ? 'rounded-lg bg-success/10 p-1.5 text-success'
                    : state?.status === 'invalid'
                      ? 'rounded-lg bg-warning/10 p-1.5 text-warning'
                      : state?.status === 'error'
                        ? 'rounded-lg bg-danger/10 p-1.5 text-danger'
                        : 'rounded-lg bg-default-200/60 p-1.5 text-foreground-400'
                }
              >
                {state?.status === 'success' ? (
                  <IoCheckmarkCircle className="text-base" />
                ) : state?.status === 'invalid' ? (
                  <IoAlertCircle className="text-base" />
                ) : state?.status === 'error' ? (
                  <IoCloseCircle className="text-base" />
                ) : (
                  <IoAlertCircle className="text-base" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground-700">
                  {provider.name}
                </div>
                {(state?.status === 'success' || state?.status === 'invalid') &&
                  state.data.location && (
                    <div
                      className="truncate text-[11px] text-foreground-400"
                      title={`${state.data.location} ${state.data.isp}`}
                    >
                      {state.data.location}
                    </div>
                  )}
              </div>
            </div>

            <Chip
              size="sm"
              variant="flat"
              color={provider.type === 'domestic' ? 'primary' : 'success'}
              className="h-5 justify-self-start px-1.5 text-[10px]"
            >
              {provider.type === 'domestic' ? t('tools.ipChecker.domestic') : t('tools.ipChecker.international')}
            </Chip>

            <div className="min-w-0">
              {state?.status === 'loading' && <Skeleton className="h-4 w-24 rounded" />}

              {state?.status === 'error' && (
                <div className="truncate text-xs font-medium text-danger" title={state.error}>
                  {getReadableError(state.error)}
                </div>
              )}

              {state?.status === 'invalid' && (
                <div className="truncate text-xs font-medium text-warning" title={state.error}>
                  {state.error}
                </div>
              )}

              {state?.status === 'success' && state.data && (
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-sm font-semibold">
                    {showIp ? state.data.ip : '•••.•••.•••.•••'}
                  </span>
                  {showIp && (
                    <Button
                      size="sm"
                      variant="light"
                      isIconOnly
                      color={copiedProviderId === provider.id ? 'success' : 'default'}
                      className="h-6 w-6 min-w-6 shrink-0"
                      title={copiedProviderId === provider.id ? t('common.copied') : t('tools.ipChecker.copyProviderIp')}
                      onPress={() => copyProviderIp(provider.id, state.data.ip)}
                    >
                      {copiedProviderId === provider.id ? (
                        <IoCheckmarkCircle className="text-xs" />
                      ) : (
                        <IoCopy className="text-xs text-foreground-400" />
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-1.5">
              {state?.status === 'loading' && <Skeleton className="h-4 w-12 rounded" />}

              {(state?.status === 'success' || state?.status === 'invalid') && state.data && (
                <span
                  className={
                    state.data.latency && state.data.latency < 200
                      ? 'font-mono text-xs text-success'
                      : 'font-mono text-xs text-warning'
                  }
                >
                  {state.data.latency ?? '-'} ms
                </span>
              )}

              {state?.status === 'error' && (
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  className="h-7 w-7 min-w-7 text-danger"
                  title={t('tools.ipChecker.retryProvider')}
                  onPress={() => fetchProvider(provider)}
                >
                  <IoRefresh className="text-sm" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
