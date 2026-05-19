import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import EditableList from '../base/base-list-editor'
import { Tabs, Tab } from '@heroui/react'
import { isValidDnsServer, isValidDomainWildcard } from '@renderer/utils/validate'
import { primaryInputClassNames } from '../settings/advanced-settings'
import { useI18n } from '@renderer/i18n'
import { getDisabledSettingTitle } from '@renderer/components/base/collapsible-setting-list'

import AppSwitch from '@renderer/components/base/app-switch'
interface AdvancedDnsSettingProps {
  respectRules: boolean
  directNameserver: string[]
  proxyServerNameserver: string[]
  nameserverPolicy: Record<string, string | string[]>
  fakeIpFilterMode: FilterMode
  hosts?: IHost[]
  useHosts: boolean
  useSystemHosts: boolean
  onRespectRulesChange: (v: boolean) => void
  onDirectNameserverChange: (list: string[]) => void
  onProxyNameserverChange: (list: string[]) => void
  onNameserverPolicyChange: (policy: Record<string, string | string[]>) => void
  onFakeIpFilterModeChange: (mode: FilterMode) => void
  onUseSystemHostsChange: (v: boolean) => void
  onUseHostsChange: (v: boolean) => void
  onHostsChange: (hosts: IHost[]) => void
  onErrorChange?: (hasError: boolean) => void
  isDisabled?: boolean
}

const AdvancedDnsSetting: React.FC<AdvancedDnsSettingProps> = ({
  respectRules,
  directNameserver,
  proxyServerNameserver,
  nameserverPolicy,
  fakeIpFilterMode,
  hosts,
  useHosts,
  useSystemHosts,
  onRespectRulesChange,
  onDirectNameserverChange,
  onProxyNameserverChange,
  onNameserverPolicyChange,
  onFakeIpFilterModeChange,
  onUseSystemHostsChange,
  onUseHostsChange,
  onHostsChange,
  onErrorChange,
  isDisabled = false
}) => {
  const { t } = useI18n()
  const [directNameserverError, setDirectNameserverError] = useState<string | null>(null)
  const [proxyNameserverError, setProxyNameserverError] = useState<string | null>(null)
  const [nameserverPolicyError, setNameserverPolicyError] = useState<string | null>(null)
  const [hostsError, setHostsError] = useState<string | null>(null)
  const hasError =
    !isDisabled &&
    Boolean(directNameserverError || proxyNameserverError || nameserverPolicyError || hostsError)

  React.useEffect(() => {
    onErrorChange?.(hasError)
  }, [hasError, onErrorChange])

  return (
    <SettingCard title={t('dns.more')} collapsible isDisabled={isDisabled} forceExpanded={hasError}>
      <SettingItem
        title={getDisabledSettingTitle(t('dns.fakeIpFilterMode'), isDisabled)}
        divider
      >
        <Tabs
          size="sm"
          color="primary"
          variant="solid"
          radius="lg"
          selectedKey={fakeIpFilterMode}
          disabledKeys={isDisabled ? ['blacklist', 'whitelist', 'rule'] : []}
          onSelectionChange={(key) => onFakeIpFilterModeChange(key as FilterMode)}
        >
          <Tab key="blacklist" title={t('dns.blacklist')} />
          <Tab key="whitelist" title={t('dns.whitelist')} />
          <Tab key="rule" title={t('dns.ruleMode')} />
        </Tabs>
      </SettingItem>
      <SettingItem
        title={getDisabledSettingTitle(t('dns.respectRules'), isDisabled)}
        divider
      >
        <AppSwitch
          size="sm"
          isSelected={respectRules}
          isDisabled={isDisabled || proxyServerNameserver.length === 0}
          onValueChange={onRespectRulesChange}
        />
      </SettingItem>
      <EditableList
        title={t('dns.directNameserver')}
        items={directNameserver}
        validate={(part) => isValidDnsServer(part as string)}
        onChange={(list) => {
          const arr = list as string[]
          onDirectNameserverChange(arr)
          const firstInvalid = arr.find((f) => !isValidDnsServer(f).ok)
          setDirectNameserverError(
            firstInvalid ? (isValidDnsServer(firstInvalid).error ?? t('common.formatError')) : null
          )
        }}
        placeholder={t('dns.placeholder.nameserver')}
        inputClassNames={primaryInputClassNames}
        isDisabled={isDisabled}
      />
      <EditableList
        title={t('dns.proxyServerNameserver')}
        items={proxyServerNameserver}
        validate={(part) => isValidDnsServer(part as string)}
        onChange={(list) => {
          const arr = list as string[]
          onProxyNameserverChange(arr)
          const firstInvalid = arr.find((f) => !isValidDnsServer(f).ok)
          setProxyNameserverError(
            firstInvalid ? (isValidDnsServer(firstInvalid).error ?? t('common.formatError')) : null
          )
        }}
        placeholder={t('dns.placeholder.nameserver')}
        inputClassNames={primaryInputClassNames}
        isDisabled={isDisabled}
      />

      <EditableList
        title={t('dns.nameserverPolicy')}
        items={nameserverPolicy}
        validatePart1={(part1) => isValidDomainWildcard(part1)}
        validatePart2={(part2) => {
          const parts = part2
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          for (const p of parts) {
            const result = isValidDnsServer(p)
            if (!result.ok) {
              return result
            }
          }
          return { ok: true }
        }}
        onChange={(newValue) => {
          onNameserverPolicyChange(newValue as Record<string, string | string[]>)
          try {
            const rec = newValue as Record<string, string | string[]>
            for (const domain of Object.keys(rec)) {
              if (!isValidDomainWildcard(domain).ok) {
                setNameserverPolicyError(
                  isValidDomainWildcard(domain).error ?? t('common.formatError')
                )
                return
              }
            }
            for (const v of Object.values(rec)) {
              if (Array.isArray(v)) {
                for (const vv of v) {
                  if (!isValidDnsServer(vv).ok) {
                    setNameserverPolicyError(isValidDnsServer(vv).error ?? t('common.formatError'))
                    return
                  }
                }
              } else {
                const parts = (v as string)
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean)
                for (const p of parts) {
                  if (!isValidDnsServer(p).ok) {
                    setNameserverPolicyError(isValidDnsServer(p).error ?? t('common.formatError'))
                    return
                  }
                }
              }
            }
            setNameserverPolicyError(null)
          } catch {
            setNameserverPolicyError(t('common.formatError'))
          }
        }}
        placeholder={t('dns.placeholder.domain')}
        part2Placeholder={t('dns.placeholder.dnsServers')}
        objectMode="record"
        inputClassNames={primaryInputClassNames}
        isDisabled={isDisabled}
      />
      <SettingItem
        title={getDisabledSettingTitle(t('dns.useSystemHosts'), isDisabled)}
        divider
      >
        <AppSwitch
          size="sm"
          isSelected={useSystemHosts}
          isDisabled={isDisabled}
          onValueChange={onUseSystemHostsChange}
        />
      </SettingItem>
      <SettingItem
        title={getDisabledSettingTitle(t('dns.customHosts'), isDisabled)}
      >
        <AppSwitch
          size="sm"
          isSelected={useHosts}
          isDisabled={isDisabled}
          onValueChange={onUseHostsChange}
        />
      </SettingItem>
      {useHosts && (
        <EditableList
          items={hosts ? Object.fromEntries(hosts.map((h) => [h.domain, h.value])) : {}}
          validatePart1={(part1) => isValidDomainWildcard(part1)}
          onChange={(rec) => {
            const hostArr: IHost[] = Object.entries(rec as Record<string, string | string[]>).map(
              ([domain, value]) => ({
                domain,
                value: value as string | string[]
              })
            )
            onHostsChange(hostArr)
            for (const domain of Object.keys(rec as Record<string, string | string[]>)) {
              if (!isValidDomainWildcard(domain).ok) {
                setHostsError(isValidDomainWildcard(domain).error ?? t('common.formatError'))
                return
              }
            }
            setHostsError(null)
          }}
          placeholder={t('dns.placeholder.domain')}
          part2Placeholder={t('dns.placeholder.hostValues')}
          objectMode="record"
          divider={false}
          inputClassNames={primaryInputClassNames}
          isDisabled={isDisabled}
        />
      )}
    </SettingCard>
  )
}

export default AdvancedDnsSetting
