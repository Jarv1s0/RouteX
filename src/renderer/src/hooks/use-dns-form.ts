import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { dnsFormSchema } from '@renderer/utils/dns-form-schema'

import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useI18n } from '@renderer/i18n'
import { applyConfigChange } from '@renderer/utils/core-restart'
import { notifyError } from '@renderer/utils/notify'

export type DnsEditorValues = z.infer<typeof dnsFormSchema>

function replaceRecord<T>(
  previous: Record<string, T> | undefined,
  next: Record<string, T>
): Record<string, T | null> {
  return {
    ...Object.fromEntries(
      Object.keys(previous || {})
        .filter((key) => !(key in next))
        .map((key) => [key, null])
    ),
    ...next
  }
}

export interface DnsSettingsEditorState {
  values: DnsEditorValues
  saving: boolean
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
    hosts,
    controlDns
  }
}

export function useDnsSettingsEditor(): DnsSettingsEditorState {
  const { t } = useI18n()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { appConfig } = useAppConfig()

  const initialValues = useMemo(
    () => buildInitialValues(appConfig, controledMihomoConfig),
    [appConfig, controledMihomoConfig]
  )

  const {
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { isDirty, isSubmitting }
  } = useForm<DnsEditorValues>({
    defaultValues: initialValues,
    resolver: zodResolver(dnsFormSchema),
    mode: 'onChange'
  })
  const values = watch()
  const savingRef = useRef(false)
  const [fakeIPRangeError, setFakeIPRangeError] = useState<string | null>(null)
  const [fakeIPRange6Error, setFakeIPRange6Error] = useState<string | null>(null)
  const [advancedDnsError, setAdvancedDnsError] = useState(false)

  useEffect(() => {
    // Background refreshes must never replace an unsaved draft.
    if (!isDirty && !savingRef.current) {
      reset(initialValues)
      setFakeIPRangeError(null)
      setFakeIPRange6Error(null)
      setAdvancedDnsError(false)
    }
  }, [initialValues, isDirty, reset])

  const setValues = (next: DnsEditorValues): void => {
    if (savingRef.current) return
    for (const key of Object.keys(next) as (keyof DnsEditorValues)[]) {
      if (JSON.stringify(next[key]) !== JSON.stringify(values[key])) {
        setValue(key, next[key], { shouldDirty: true, shouldValidate: true })
      }
    }
  }
  const saveDisabled =
    isSubmitting ||
    !dnsFormSchema.safeParse(values).success ||
    (values.controlDns && advancedDnsError)
  const submit = async (values: DnsEditorValues): Promise<void> => {
    if (!values.controlDns) {
      await applyConfigChange({ app: { controlDns: false }, core: {} })
      reset(values)
      return
    }

    const hostsObject =
      values.useHosts && values.hosts && values.hosts.length > 0
        ? Object.fromEntries(values.hosts.map(({ domain, value }) => [domain, value]))
        : undefined

    await applyConfigChange({
      app: { hosts: values.hosts, controlDns: values.controlDns },
      core: {
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
            Object.keys(values.fallbackFilter).length > 0
              ? replaceRecord(
                  controledMihomoConfig?.dns?.['fallback-filter'],
                  values.fallbackFilter
                )
              : null,
          'proxy-server-nameserver': values.proxyServerNameserver,
          'direct-nameserver': values.directNameserver,
          'direct-nameserver-follow-policy': values.directNameserverFollowPolicy,
          'nameserver-policy':
            Object.keys(values.nameserverPolicy).length > 0
              ? replaceRecord(
                  controledMihomoConfig?.dns?.['nameserver-policy'],
                  values.nameserverPolicy
                )
              : null,
          'cache-algorithm': values.cacheAlgorithm || null
        },
        hosts: hostsObject ? replaceRecord(controledMihomoConfig?.hosts, hostsObject) : null
      }
    })
    reset(values)
  }

  const save = async (): Promise<void> => {
    if (savingRef.current || saveDisabled) return
    savingRef.current = true
    try {
      await handleSubmit(submit)()
    } catch (error) {
      notifyError(error, { title: t('dns.applyFailed') })
    } finally {
      savingRef.current = false
    }
  }

  return {
    values,
    saving: isSubmitting,
    changed: isDirty,
    saveDisabled,
    save,
    setValues,
    fakeIPRangeError,
    fakeIPRange6Error,
    setFakeIPRangeError,
    setFakeIPRange6Error,
    setAdvancedDnsError
  }
}
