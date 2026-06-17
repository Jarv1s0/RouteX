import { useEffect, useMemo, useState } from 'react'

import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useI18n } from '@renderer/i18n'
import { restartCoreInBackground } from '@renderer/utils/core-restart'
import { notifyError } from '@renderer/utils/notify'
import {
  isValidDnsServer,
  isValidDomainWildcard,
  isValidIPv4Cidr,
  isValidIPv6Cidr,
  isValidListenAddress
} from '@renderer/utils/validate'

export interface DnsEditorValues {
  listen: string
  ipv6: boolean
  ipv6Timeout: string
  preferH3: boolean
  useHosts: boolean
  enhancedMode: DnsMode
  fakeIPRange: string
  fakeIPRange6: string
  fakeIPFilter: string[]
  fakeIPFilterMode: FilterMode
  useSystemHosts: boolean
  respectRules: boolean
  defaultNameserver: string[]
  nameserver: string[]
  fallback: string[]
  fallbackFilter: Record<string, boolean | string | string[]>
  proxyServerNameserver: string[]
  directNameserver: string[]
  directNameserverFollowPolicy: boolean
  nameserverPolicy: Record<string, string | string[]>
  cacheAlgorithm: string
  hosts?: IHost[]
  controlDns: boolean
}

export interface DnsSettingsEditorState {
  values: DnsEditorValues
  changed: boolean
  saveDisabled: boolean
  save: () => Promise<void>
  setValues: (next: DnsEditorValues) => void
  fakeIPRangeError: string | null
  fakeIPRange6Error: string | null
  setFakeIPRangeError: React.Dispatch<React.SetStateAction<string | null>>
  setFakeIPRange6Error: React.Dispatch<React.SetStateAction<string | null>>
  setAdvancedDnsError: React.Dispatch<React.SetStateAction<boolean>>
}

function buildInitialValues(
  appConfig: AppConfig | undefined,
  controledMihomoConfig: Partial<MihomoConfig> | undefined
): DnsEditorValues {
  const { hosts = [], controlDns = true } = appConfig || {}
  const { dns } = controledMihomoConfig || {}
  const {
    listen = '',
    ipv6 = false,
    'ipv6-timeout': ipv6Timeout,
    'prefer-h3': preferH3 = false,
    'fake-ip-range': fakeIPRange = '198.18.0.1/16',
    'fake-ip-range6': fakeIPRange6 = '',
    'fake-ip-filter': fakeIPFilter = [
      '*',
      '+.lan',
      '+.local',
      'time.*.com',
      'ntp.*.com',
      '+.market.xiaomi.com'
    ],
    'fake-ip-filter-mode': fakeIPFilterMode = 'blacklist',
    'enhanced-mode': enhancedMode = 'fake-ip',
    'use-hosts': useHosts = false,
    'use-system-hosts': useSystemHosts = false,
    'respect-rules': respectRules = false,
    'default-nameserver': defaultNameserver = ['tls://223.5.5.5'],
    nameserver = ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
    fallback = [],
    'fallback-filter': fallbackFilter = {},
    'proxy-server-nameserver': proxyServerNameserver = [],
    'direct-nameserver': directNameserver = [],
    'direct-nameserver-follow-policy': directNameserverFollowPolicy = false,
    'nameserver-policy': nameserverPolicy = {},
    'cache-algorithm': cacheAlgorithm = ''
  } = dns || {}

  return {
    listen,
    ipv6,
    ipv6Timeout: typeof ipv6Timeout === 'number' ? String(ipv6Timeout) : '',
    preferH3,
    useHosts,
    enhancedMode,
    fakeIPRange,
    fakeIPRange6,
    fakeIPFilter,
    fakeIPFilterMode,
    useSystemHosts,
    respectRules,
    defaultNameserver,
    nameserver,
    fallback,
    fallbackFilter,
    proxyServerNameserver,
    directNameserver,
    directNameserverFollowPolicy,
    nameserverPolicy,
    cacheAlgorithm,
    hosts: useHosts ? hosts : undefined,
    controlDns
  }
}

export function useDnsSettingsEditor(): DnsSettingsEditorState {
  const { t } = useI18n()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()

  const initialValues = useMemo(
    () => buildInitialValues(appConfig, controledMihomoConfig),
    [appConfig, controledMihomoConfig]
  )

  const [values, setValuesState] = useState<DnsEditorValues>(initialValues)
  const [fakeIPRangeError, setFakeIPRangeError] = useState<string | null>(null)
  const [fakeIPRange6Error, setFakeIPRange6Error] = useState<string | null>(null)
  const [advancedDnsError, setAdvancedDnsError] = useState(false)

  useEffect(() => {
    setValuesState(initialValues)
    const range4 = isValidIPv4Cidr(initialValues.fakeIPRange)
    setFakeIPRangeError(range4.ok ? null : (range4.error ?? t('common.formatError')))
    const range6 = isValidIPv6Cidr(initialValues.fakeIPRange6)
    setFakeIPRange6Error(range6.ok ? null : (range6.error ?? t('common.formatError')))
    setAdvancedDnsError(false)
  }, [initialValues, t])

  const changed = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues)
  }, [initialValues, values])

  const fakeIPFilterHasError = useMemo(() => {
    return values.fakeIPFilter.some((item) => !isValidDomainWildcard(item).ok)
  }, [values.fakeIPFilter])

  const defaultNameserverHasError = useMemo(() => {
    return values.defaultNameserver.some((item) => !isValidDnsServer(item, true).ok)
  }, [values.defaultNameserver])

  const nameserverHasError = useMemo(() => {
    return values.nameserver.some((item) => !isValidDnsServer(item).ok)
  }, [values.nameserver])

  const fallbackHasError = useMemo(() => {
    return values.fallback.some((item) => !isValidDnsServer(item).ok)
  }, [values.fallback])

  const listenHasError = useMemo(() => {
    return values.listen.trim() !== '' && !isValidListenAddress(values.listen).ok
  }, [values.listen])

  const ipv6TimeoutHasError = useMemo(() => {
    return values.ipv6Timeout.trim() !== '' && !/^[1-9]\d*$/.test(values.ipv6Timeout.trim())
  }, [values.ipv6Timeout])

  const hasDnsErrors =
    defaultNameserverHasError || nameserverHasError || fallbackHasError || advancedDnsError

  const saveDisabled = !values.controlDns
    ? false
    : values.enhancedMode === 'fake-ip'
      ? Boolean(fakeIPRangeError) ||
        (values.ipv6 && Boolean(fakeIPRange6Error)) ||
        fakeIPFilterHasError ||
        listenHasError ||
        ipv6TimeoutHasError ||
        hasDnsErrors
      : listenHasError || ipv6TimeoutHasError || hasDnsErrors

  const save = async (): Promise<void> => {
    if (!values.controlDns) {
      try {
        await patchAppConfig({ controlDns: false })
        await patchControledMihomoConfig({})
        restartCoreInBackground(t('dns.applyFailed'))
      } catch (error) {
        notifyError(error)
      }
      return
    }

    const hostsObject =
      values.useHosts && values.hosts && values.hosts.length > 0
        ? Object.fromEntries(values.hosts.map(({ domain, value }) => [domain, value]))
        : undefined

    try {
      await patchAppConfig({
        hosts: values.hosts,
        controlDns: values.controlDns
      })
      await patchControledMihomoConfig({
        dns: {
          enable: true,
          listen: values.listen.trim() || null,
          ipv6: values.ipv6,
          'ipv6-timeout': values.ipv6Timeout.trim() ? Number(values.ipv6Timeout.trim()) : null,
          'prefer-h3': values.preferH3,
          'fake-ip-range': values.fakeIPRange,
          'fake-ip-range6': values.fakeIPRange6,
          'fake-ip-filter': values.fakeIPFilter,
          'fake-ip-filter-mode': values.fakeIPFilterMode,
          'enhanced-mode': values.enhancedMode,
          'use-hosts': values.useHosts,
          'use-system-hosts': values.useSystemHosts,
          'respect-rules': values.respectRules,
          'default-nameserver': values.defaultNameserver,
          nameserver: values.nameserver,
          fallback: values.fallback,
          'fallback-filter':
            Object.keys(values.fallbackFilter).length > 0 ? values.fallbackFilter : null,
          'proxy-server-nameserver': values.proxyServerNameserver,
          'direct-nameserver': values.directNameserver,
          'direct-nameserver-follow-policy': values.directNameserverFollowPolicy,
          'nameserver-policy':
            Object.keys(values.nameserverPolicy).length > 0 ? values.nameserverPolicy : null,
          'cache-algorithm': values.cacheAlgorithm || null
        },
        hosts: hostsObject ?? null
      } as unknown as Partial<MihomoConfig>)
      restartCoreInBackground(t('dns.applyFailed'))
    } catch (error) {
      notifyError(error)
    }
  }

  return {
    values,
    changed,
    saveDisabled,
    save,
    setValues: setValuesState,
    fakeIPRangeError,
    fakeIPRange6Error,
    setFakeIPRangeError,
    setFakeIPRange6Error,
    setAdvancedDnsError
  }
}
