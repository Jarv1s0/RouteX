import React, { Key, useEffect, useMemo, useState } from 'react'
import { Input, Tab, Tabs, Tooltip } from '@heroui/react'

import EditableList from '@renderer/components/base/base-list-editor'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { primaryInputClassNames } from '@renderer/components/settings/advanced-settings'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { restartCoreInBackground } from '@renderer/utils/core-restart'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'
import {
  isValidDomainWildcard,
  isValidDnsServer,
  isValidIPv4Cidr,
  isValidIPv6Cidr
} from '@renderer/utils/validate'

import AdvancedDnsSetting from './advanced-dns-setting'

import AppSwitch from '@renderer/components/base/app-switch'
interface DnsEditorValues {
  ipv6: boolean
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
  proxyServerNameserver: string[]
  directNameserver: string[]
  nameserverPolicy: Record<string, string | string[]>
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
    ipv6 = false,
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
    'proxy-server-nameserver': proxyServerNameserver = [],
    'direct-nameserver': directNameserver = [],
    'nameserver-policy': nameserverPolicy = {}
  } = dns || {}

  return {
    ipv6,
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
    proxyServerNameserver,
    directNameserver,
    nameserverPolicy,
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

  const hasDnsErrors = defaultNameserverHasError || nameserverHasError || advancedDnsError

  const saveDisabled =
    values.enhancedMode === 'fake-ip'
      ? Boolean(fakeIPRangeError) ||
        (values.ipv6 && Boolean(fakeIPRange6Error)) ||
        fakeIPFilterHasError ||
        hasDnsErrors
      : hasDnsErrors

  const save = async (): Promise<void> => {
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
          ipv6: values.ipv6,
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
          'proxy-server-nameserver': values.proxyServerNameserver,
          'direct-nameserver': values.directNameserver,
          'nameserver-policy': values.nameserverPolicy
        },
        hosts: hostsObject
      })
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

export const DnsSettingsFormFields: React.FC<{ editor: DnsSettingsEditorState }> = ({ editor }) => {
  const { t } = useI18n()
  const {
    values,
    setValues,
    fakeIPRangeError,
    fakeIPRange6Error,
    setFakeIPRangeError,
    setFakeIPRange6Error,
    setAdvancedDnsError
  } = editor

  return (
    <>
      <SettingCard>
        <SettingItem title={t('page.dns.title')} divider>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${values.controlDns ? 'text-primary' : 'text-default-400'}`}>
              {values.controlDns ? t('common.enabled') : t('common.disabled')}
            </span>
            <AppSwitch
              size="sm"
              isSelected={values.controlDns}
              onValueChange={(value) => setValues({ ...values, controlDns: value })}
            />
          </div>
        </SettingItem>
        <SettingItem title="IPv6" divider>
          <AppSwitch
            size="sm"
            isSelected={values.ipv6}
            onValueChange={(value) => setValues({ ...values, ipv6: value })}
          />
        </SettingItem>
        <SettingItem title={t('dns.enhancedMode')} divider>
          <Tabs
            classNames={CARD_STYLES.GLASS_TABS}
            selectedKey={values.enhancedMode}
            onSelectionChange={(key: Key) => setValues({ ...values, enhancedMode: key as DnsMode })}
          >
            <Tab key="fake-ip" title={t('dns.fakeIp')} />
            <Tab key="redir-host" title={t('dns.redirHost')} />
            <Tab key="normal" title={t('dns.normal')} />
          </Tabs>
        </SettingItem>
        {values.enhancedMode === 'fake-ip' && (
          <>
            <SettingItem title={t('dns.fakeIpRange4')} divider>
              <Tooltip
                content={fakeIPRangeError}
                placement="right"
                isOpen={!!fakeIPRangeError}
                showArrow={true}
                color="danger"
                offset={15}
              >
                <Input
                  size="sm"
                  className={
                    `w-[40%] ` +
                    (fakeIPRangeError ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : '')
                  }
                  classNames={fakeIPRangeError ? undefined : primaryInputClassNames}
                  placeholder={t('dns.placeholder.fakeIpRange4')}
                  value={values.fakeIPRange}
                  onValueChange={(value) => {
                    setValues({ ...values, fakeIPRange: value })
                    const result = isValidIPv4Cidr(value)
                    setFakeIPRangeError(
                      result.ok ? null : (result.error ?? t('common.formatError'))
                    )
                  }}
                />
              </Tooltip>
            </SettingItem>
            {values.ipv6 && (
              <SettingItem title={t('dns.fakeIpRange6')} divider>
                <Tooltip
                  content={fakeIPRange6Error}
                  placement="right"
                  isOpen={!!fakeIPRange6Error}
                  showArrow={true}
                  color="danger"
                  offset={10}
                >
                  <Input
                    size="sm"
                    className={
                      `w-[40%] ` +
                      (fakeIPRange6Error ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : '')
                    }
                    classNames={fakeIPRange6Error ? undefined : primaryInputClassNames}
                    placeholder={t('dns.placeholder.fakeIpRange6')}
                    value={values.fakeIPRange6}
                    onValueChange={(value) => {
                      setValues({ ...values, fakeIPRange6: value })
                      const result = isValidIPv6Cidr(value)
                      setFakeIPRange6Error(
                        result.ok ? null : (result.error ?? t('common.formatError'))
                      )
                    }}
                  />
                </Tooltip>
              </SettingItem>
            )}
            <EditableList
              title={t('dns.fakeIpFilter')}
              items={values.fakeIPFilter}
              validate={(part) => isValidDomainWildcard(part as string)}
              onChange={(list) => {
                setValues({ ...values, fakeIPFilter: list as string[] })
              }}
              placeholder={t('dns.placeholder.fakeIpFilter')}
              inputClassNames={primaryInputClassNames}
            />
          </>
        )}
        <EditableList
          title={t('dns.baseNameserver')}
          items={values.defaultNameserver}
          validate={(part) => isValidDnsServer(part as string, true)}
          onChange={(list) => {
            setValues({ ...values, defaultNameserver: list as string[] })
          }}
          placeholder={t('dns.placeholder.baseNameserver')}
          inputClassNames={primaryInputClassNames}
        />
        <EditableList
          title={t('dns.defaultNameserver')}
          items={values.nameserver}
          validate={(part) => isValidDnsServer(part as string)}
          onChange={(list) => {
            setValues({ ...values, nameserver: list as string[] })
          }}
          placeholder={t('dns.placeholder.nameserver')}
          divider={false}
          inputClassNames={primaryInputClassNames}
        />
      </SettingCard>
      <AdvancedDnsSetting
        respectRules={values.respectRules}
        directNameserver={values.directNameserver}
        proxyServerNameserver={values.proxyServerNameserver}
        nameserverPolicy={values.nameserverPolicy}
        fakeIpFilterMode={values.fakeIPFilterMode}
        hosts={values.hosts}
        useHosts={values.useHosts}
        useSystemHosts={values.useSystemHosts}
        onRespectRulesChange={(value) => {
          setValues({
            ...values,
            respectRules: values.proxyServerNameserver.length === 0 ? false : value
          })
        }}
        onDirectNameserverChange={(list) => {
          setValues({ ...values, directNameserver: list })
        }}
        onProxyNameserverChange={(list) => {
          setValues({
            ...values,
            proxyServerNameserver: list,
            respectRules: list.length === 0 ? false : values.respectRules
          })
        }}
        onNameserverPolicyChange={(newValue) => {
          setValues({ ...values, nameserverPolicy: newValue })
        }}
        onFakeIpFilterModeChange={(mode) => setValues({ ...values, fakeIPFilterMode: mode })}
        onUseSystemHostsChange={(value) => setValues({ ...values, useSystemHosts: value })}
        onUseHostsChange={(value) => setValues({ ...values, useHosts: value })}
        onHostsChange={(hostArr) => setValues({ ...values, hosts: hostArr })}
        onErrorChange={setAdvancedDnsError}
      />
    </>
  )
}
