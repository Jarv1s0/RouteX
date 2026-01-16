import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import InterfaceSelect from '../base/interface-select'
import { restartCore, startNetworkDetection, stopNetworkDetection } from '@renderer/utils/ipc'
import { Button, Input, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
import { useState } from 'react'
import { IoIosHelpCircle } from 'react-icons/io'
import { secondaryInputClassNames } from '../settings/advanced-settings'
import EditableList from '../base/base-list-editor'

const AdvancedSetting: React.FC = () => {
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
    <SettingCard title="高级设置" collapsible>
      <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2">
        <div className="ml-2">
          <SettingItem title="查找进程" divider>
        <Tabs
          size="sm"
          color="primary"
          selectedKey={findProcessMode}
          onSelectionChange={(key) => {
            onChangeNeedRestart({ 'find-process-mode': key as FindProcessMode })
          }}
        >
          <Tab key="strict" title="自动"></Tab>
          <Tab key="off" title="关闭"></Tab>
          <Tab key="always" title="开启"></Tab>
        </Tabs>
      </SettingItem>
      <SettingItem title="存储选择节点" divider>
        <Switch
          size="sm"
          isSelected={storeSelected}
          onValueChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-selected': v } })
          }}
        />
      </SettingItem>
      <SettingItem title="存储 FakeIP" divider>
        <Switch
          size="sm"
          isSelected={storeFakeIp}
          onValueChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-fake-ip': v } })
          }}
        />
      </SettingItem>
      <SettingItem
        title="使用 RTT 延迟测试"
        actions={
          <Tooltip content="开启后会使用统一延迟测试来获取节点延迟，以消除不同节点握手时间的影响">
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
        title="TCP 并发"
        actions={
          <Tooltip content="对 dns 解析出的多个 IP 地址进行 TCP 并发连接，使用握手时间最短的连接">
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
      <SettingItem title="TCP Keep Alive 设置" divider>
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
            <SettingItem title="TCP Keep Alive 间隔">
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
                    确认
                  </Button>
                )}
                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  classNames={secondaryInputClassNames}
                  value={intervalInput.toString()}
                  min={0}
                  onValueChange={(v) => {
                    setIntervalInput(parseInt(v) || 0)
                  }}
                />
              </div>
            </SettingItem>
            <SettingItem title="TCP Keep Alive 空闲">
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
                    确认
                  </Button>
                )}
                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  classNames={secondaryInputClassNames}
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
        title="断网时停止内核"
        actions={
          <Tooltip content="开启后，应用会在检测到网络断开时自动停止内核，并在网络恢复后自动重启内核">
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
            <SettingItem title="断网检测间隔">
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
                    确认
                  </Button>
                )}
                <Input
                  size="sm"
                  type="number"
                  className="w-[100px]"
                  classNames={secondaryInputClassNames}
                  endContent="秒"
                  value={detectionInterval.toString()}
                  min={1}
                  onValueChange={(v) => {
                    setDetectionInterval(parseInt(v))
                  }}
                />
              </div>
            </SettingItem>
            <SettingItem title="绕过检测的接口">
              {bypass.length != networkDetectionBypass.length && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={async () => {
                    await patchAppConfig({ networkDetectionBypass: bypass })
                    await startNetworkDetection()
                  }}
                >
                  确认
                </Button>
              )}
            </SettingItem>
            <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1">
              <div className="ml-6">
                <EditableList items={bypass} onChange={(list) => setBypass(list as string[])} />
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingItem title="指定出站接口">
        <InterfaceSelect
          value={interfaceName}
          exclude={[device, 'lo']}
          onChange={(iface) => onChangeNeedRestart({ 'interface-name': iface })}
        />
      </SettingItem>
        </div>
      </div>
    </SettingCard>
  )
}

export default AdvancedSetting
