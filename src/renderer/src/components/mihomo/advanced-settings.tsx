import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import InterfaceSelect from '../base/interface-select'
import {
  restartCore,
  startNetworkDetection,
  stopNetworkDetection
} from '@renderer/utils/mihomo-ipc'
import { Button, Input, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
import { useState } from 'react'
import { IoIosHelpCircle } from 'react-icons/io'
import { numberInputClassNames, secondaryInputClassNames } from '../settings/advanced-settings'
import EditableList from '../base/base-list-editor'
import { useI18n } from '@renderer/i18n'

const AdvancedSetting: React.FC = () => {
  const { t } = useI18n()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    'unified-delay': unifiedDelay,
    'tcp-concurrent': tcpConcurrent,
    'disable-keep-alive': disableKeepAlive = false,
    'find-process-mode': findProcessMode = 'always',
    'interface-name': interfaceName = '',

    'keep-alive-idle': idle = 15,
    'keep-alive-interval': interval = 15,
    profile = {},
    tun = {}
  } = controledMihomoConfig || {}
  const { 'store-selected': storeSelected, 'store-fake-ip': storeFakeIp } = profile
  const { device = 'mihomo' } = tun

  const {
    networkDetection = false,
    networkDetectionBypass = ['VMware', 'vEthernet'],
    networkDetectionInterval = 10
  } = appConfig || {}

  const [idleInput, setIdleInput] = useState(idle)
  const [intervalInput, setIntervalInput] = useState(interval)
  const [bypass, setBypass] = useState(networkDetectionBypass)
  const [detectionInterval, setDetectionInterval] = useState(networkDetectionInterval)

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <SettingCard title={t('mihomo.advancedSettings')} collapsible>
      <SettingItem title={t('mihomo.findProcess')} divider>
        <Tabs
          size="sm"
          color="primary"
          variant="solid"
          radius="lg"
          selectedKey={findProcessMode}
          onSelectionChange={(key) => {
            onChangeNeedRestart({ 'find-process-mode': key as FindProcessMode })
          }}
        >
          <Tab key="strict" title={t('common.auto')}></Tab>
          <Tab key="off" title={t('common.disable')}></Tab>
          <Tab key="always" title={t('common.enable')}></Tab>
        </Tabs>
      </SettingItem>
      <SettingItem title={t('mihomo.storeSelected')} divider>
        <Switch
          size="sm"
          isSelected={storeSelected}
          onValueChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-selected': v } })
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.storeFakeIp')} divider>
        <Switch
          size="sm"
          isSelected={storeFakeIp}
          onValueChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-fake-ip': v } })
          }}
        />
      </SettingItem>
      <SettingItem
        title={t('mihomo.unifiedDelay')}
        actions={
          <Tooltip content={t('mihomo.unifiedDelayHelp')}>
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={unifiedDelay}
          onValueChange={(v) => {
            onChangeNeedRestart({ 'unified-delay': v })
          }}
        />
      </SettingItem>
      <SettingItem
        title={t('mihomo.tcpConcurrent')}
        actions={
          <Tooltip content={t('mihomo.tcpConcurrentHelp')}>
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={tcpConcurrent}
          onValueChange={(v) => {
            onChangeNeedRestart({ 'tcp-concurrent': v })
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.keepAlive')} divider>
        <Switch
          size="sm"
          isSelected={!disableKeepAlive}
          onValueChange={(v) => {
            onChangeNeedRestart({ 'disable-keep-alive': !v })
          }}
        />
      </SettingItem>
      {!disableKeepAlive && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-3 mt-2 mb-4">
          <div className="ml-4 text-sm">
            <SettingItem title={t('mihomo.keepAliveInterval')}>
              <div className="flex">
                {intervalInput !== interval && (
                  <Button
                    size="sm"
                    color="primary"
                    className="mr-2"
                    onPress={async () => {
                      await onChangeNeedRestart({ 'keep-alive-interval': intervalInput })
                    }}
                  >
                    {t('common.confirm')}
                  </Button>
                )}
                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  classNames={numberInputClassNames}
                  value={intervalInput.toString()}
                  min={0}
                  onValueChange={(v) => {
                    setIntervalInput(parseInt(v) || 0)
                  }}
                />
              </div>
            </SettingItem>
            <SettingItem title={t('mihomo.keepAliveIdle')}>
              <div className="flex">
                {idleInput !== idle && (
                  <Button
                    size="sm"
                    color="primary"
                    className="mr-2"
                    onPress={async () => {
                      await onChangeNeedRestart({ 'keep-alive-idle': idleInput })
                    }}
                  >
                    {t('common.confirm')}
                  </Button>
                )}
                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  classNames={numberInputClassNames}
                  value={idleInput.toString()}
                  min={0}
                  onValueChange={(v) => {
                    setIdleInput(parseInt(v) || 0)
                  }}
                />
              </div>
            </SettingItem>
          </div>
        </div>
      )}
      <SettingItem
        title={t('mihomo.stopCoreWhenOffline')}
        actions={
          <Tooltip content={t('mihomo.stopCoreWhenOfflineHelp')}>
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={networkDetection}
          onValueChange={(v) => {
            patchAppConfig({ networkDetection: v })
            if (v) {
              startNetworkDetection()
            } else {
              stopNetworkDetection()
            }
          }}
        />
      </SettingItem>
      {networkDetection && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-3 mt-2 mb-4">
          <div className="ml-4 text-sm">
            <SettingItem title={t('mihomo.networkDetectionInterval')}>
              <div className="flex">
                {detectionInterval !== networkDetectionInterval && (
                  <Button
                    size="sm"
                    color="primary"
                    className="mr-2"
                    onPress={async () => {
                      await patchAppConfig({ networkDetectionInterval: detectionInterval })
                      await startNetworkDetection()
                    }}
                  >
                    {t('common.confirm')}
                  </Button>
                )}
                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  classNames={numberInputClassNames}
                  endContent={t('common.seconds')}
                  value={detectionInterval.toString()}
                  min={1}
                  onValueChange={(v) => {
                    setDetectionInterval(parseInt(v))
                  }}
                />
              </div>
            </SettingItem>
            <SettingItem title={t('mihomo.networkDetectionBypass')}>
              {bypass.length != networkDetectionBypass.length && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={async () => {
                    await patchAppConfig({ networkDetectionBypass: bypass })
                    await startNetworkDetection()
                  }}
                >
                  {t('common.confirm')}
                </Button>
              )}
            </SettingItem>
            <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1">
              <div className="ml-6">
                <EditableList
                  items={bypass}
                  onChange={(list) => setBypass(list as string[])}
                  inputClassNames={secondaryInputClassNames}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingItem title={t('mihomo.outboundInterface')}>
        <InterfaceSelect
          value={interfaceName}
          exclude={[device, 'lo']}
          onChange={(iface) => onChangeNeedRestart({ 'interface-name': iface })}
        />
      </SettingItem>
    </SettingCard>
  )
}

export default AdvancedSetting
