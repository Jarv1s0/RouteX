import React, { useEffect, useMemo, useState } from 'react'
import { Input, Switch } from '@heroui/react'

import EditableList from '@renderer/components/base/base-list-editor'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { primaryInputClassNames } from '@renderer/components/settings/advanced-settings'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore } from '@renderer/utils/mihomo-ipc'
import { notifyError } from '@renderer/utils/notify'

interface SnifferEditorValues {
  parsePureIP: boolean
  forceDNSMapping: boolean
  overrideDestination: boolean
  sniff: NonNullable<MihomoSnifferConfig['sniff']>
  skipDomain: string[]
  forceDomain: string[]
  skipDstAddress: string[]
  skipSrcAddress: string[]
}

export interface SnifferSettingsEditorState {
  values: SnifferEditorValues
  changed: boolean
  save: () => Promise<void>
  setValues: (next: SnifferEditorValues) => void
  handleSniffPortChange: (protocol: keyof NonNullable<MihomoSnifferConfig['sniff']>, value: string) => void
}

function buildInitialValues(
  controledMihomoConfig: Partial<MihomoConfig> | undefined
): SnifferEditorValues {
  const { sniffer } = controledMihomoConfig || {}
  const {
    'parse-pure-ip': parsePureIP = true,
    'force-dns-mapping': forceDNSMapping = true,
    'override-destination': overrideDestination = false,
    sniff = {
      HTTP: { ports: [80, 443], 'override-destination': false },
      TLS: { ports: [443] },
      QUIC: { ports: [] }
    },
    'skip-domain': skipDomain = ['+.push.apple.com'],
    'force-domain': forceDomain = [],
    'skip-dst-address': skipDstAddress = [
      '91.105.192.0/23',
      '91.108.4.0/22',
      '91.108.8.0/21',
      '91.108.16.0/21',
      '91.108.56.0/22',
      '95.161.64.0/20',
      '149.154.160.0/20',
      '185.76.151.0/24',
      '2001:67c:4e8::/48',
      '2001:b28:f23c::/47',
      '2001:b28:f23f::/48',
      '2a0a:f280:203::/48'
    ],
    'skip-src-address': skipSrcAddress = []
  } = sniffer || {}

  return {
    parsePureIP,
    forceDNSMapping,
    overrideDestination,
    sniff: {
      HTTP: {
        ports: sniff.HTTP?.ports || [80, 443],
        'override-destination': sniff.HTTP?.['override-destination'] ?? overrideDestination
      },
      TLS: {
        ports: sniff.TLS?.ports || [443]
      },
      QUIC: {
        ports: sniff.QUIC?.ports || []
      }
    },
    skipDomain,
    forceDomain,
    skipDstAddress,
    skipSrcAddress
  }
}

export function useSnifferSettingsEditor(): SnifferSettingsEditorState {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()

  const initialValues = useMemo(
    () => buildInitialValues(controledMihomoConfig),
    [controledMihomoConfig]
  )

  const [values, setValuesState] = useState<SnifferEditorValues>(initialValues)

  useEffect(() => {
    setValuesState(initialValues)
  }, [initialValues])

  const changed = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues)
  }, [initialValues, values])

  const save = async (): Promise<void> => {
    try {
      await patchControledMihomoConfig({
        sniffer: {
          'parse-pure-ip': values.parsePureIP,
          'force-dns-mapping': values.forceDNSMapping,
          'override-destination': values.overrideDestination,
          sniff: values.sniff,
          'skip-domain': values.skipDomain,
          'force-domain': values.forceDomain,
          'skip-dst-address': values.skipDstAddress,
          'skip-src-address': values.skipSrcAddress
        }
      })
      await restartCore()
    } catch (error) {
      notifyError(error)
    }
  }

  const handleSniffPortChange = (
    protocol: keyof NonNullable<MihomoSnifferConfig['sniff']>,
    value: string
  ): void => {
    setValuesState({
      ...values,
      sniff: {
        ...values.sniff,
        [protocol]: {
          ...values.sniff[protocol],
          ports: value.split(',').map((port) => port.trim())
        }
      }
    })
  }

  return {
    values,
    changed,
    save,
    setValues: setValuesState,
    handleSniffPortChange
  }
}

export const SnifferSettingsFormFields: React.FC<{ editor: SnifferSettingsEditorState }> = ({ editor }) => {
  const { values, setValues, handleSniffPortChange } = editor

  return (
    <SettingCard>
      <SettingItem title="覆盖连接地址" divider>
        <Switch
          size="sm"
          isSelected={values.overrideDestination}
          onValueChange={(value) => {
            setValues({
              ...values,
              overrideDestination: value,
              sniff: {
                ...values.sniff,
                HTTP: {
                  ...values.sniff.HTTP,
                  'override-destination': value,
                  ports: values.sniff.HTTP?.ports || [80, 443]
                }
              }
            })
          }}
        />
      </SettingItem>
      <SettingItem title="对真实 IP 映射嗅探" divider>
        <Switch
          size="sm"
          isSelected={values.forceDNSMapping}
          onValueChange={(value) => {
            setValues({ ...values, forceDNSMapping: value })
          }}
        />
      </SettingItem>
      <SettingItem title="对未映射 IP 地址嗅探" divider>
        <Switch
          size="sm"
          isSelected={values.parsePureIP}
          onValueChange={(value) => {
            setValues({ ...values, parsePureIP: value })
          }}
        />
      </SettingItem>
      <SettingItem title="HTTP 端口嗅探" divider>
        <Input
          size="sm"
          className="w-[50%]"
          classNames={primaryInputClassNames}
          placeholder="端口号，使用逗号分割多个值"
          value={values.sniff.HTTP?.ports.join(',')}
          onValueChange={(value) => handleSniffPortChange('HTTP', value)}
        />
      </SettingItem>
      <SettingItem title="TLS 端口嗅探" divider>
        <Input
          size="sm"
          className="w-[50%]"
          classNames={primaryInputClassNames}
          placeholder="端口号，使用逗号分割多个值"
          value={values.sniff.TLS?.ports.join(',')}
          onValueChange={(value) => handleSniffPortChange('TLS', value)}
        />
      </SettingItem>
      <SettingItem title="QUIC 端口嗅探" divider>
        <Input
          size="sm"
          className="w-[50%]"
          classNames={primaryInputClassNames}
          placeholder="端口号，使用逗号分割多个值"
          value={values.sniff.QUIC?.ports.join(',')}
          onValueChange={(value) => handleSniffPortChange('QUIC', value)}
        />
      </SettingItem>
      <EditableList
        title="跳过域名嗅探"
        items={values.skipDomain}
        onChange={(list) => setValues({ ...values, skipDomain: list as string[] })}
        placeholder="例：+.push.apple.com"
        inputClassNames={primaryInputClassNames}
      />
      <EditableList
        title="强制域名嗅探"
        items={values.forceDomain}
        onChange={(list) => setValues({ ...values, forceDomain: list as string[] })}
        placeholder="例：v2ex.com"
        inputClassNames={primaryInputClassNames}
      />
      <EditableList
        title="跳过目标地址嗅探"
        items={values.skipDstAddress}
        onChange={(list) => setValues({ ...values, skipDstAddress: list as string[] })}
        placeholder="例：1.1.1.1/32"
        inputClassNames={primaryInputClassNames}
      />
      <EditableList
        title="跳过来源地址嗅探"
        items={values.skipSrcAddress}
        onChange={(list) => setValues({ ...values, skipSrcAddress: list as string[] })}
        placeholder="例：192.168.1.1/24"
        divider={false}
        inputClassNames={primaryInputClassNames}
      />
    </SettingCard>
  )
}
