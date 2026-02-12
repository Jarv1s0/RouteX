import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Switch } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'
import EditableList from '../base/base-list-editor'
import { platform } from '@renderer/utils/init'
import { secondaryInputClassNames } from '../settings/advanced-settings'

const EnvSetting: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    disableLoopbackDetector,
    disableEmbedCA,
    disableSystemCA,
    disableNftables,
    safePaths = []
  } = appConfig || {}
  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await patchAppConfig({ [key]: value })
      await restartCore()
    } catch (e) {
      alert(e)
    } finally {
      PubSub.publish('mihomo-core-changed')
    }
  }
  const [safePathsInput, setSafePathsInput] = useState(safePaths)

  return (
    <SettingCard title="环境变量" collapsible>
          <SettingItem title="禁用系统 CA" divider>
        <Switch
          size="sm"
          isSelected={disableSystemCA}
          onValueChange={(v) => {
            handleConfigChangeWithRestart('disableSystemCA', v)
          }}
        />
      </SettingItem>
      <SettingItem title="禁用内置 CA" divider>
        <Switch
          size="sm"
          isSelected={disableEmbedCA}
          onValueChange={(v) => {
            handleConfigChangeWithRestart('disableEmbedCA', v)
          }}
        />
      </SettingItem>
      <SettingItem title="禁用回环检测" divider>
        <Switch
          size="sm"
          isSelected={disableLoopbackDetector}
          onValueChange={(v) => {
            handleConfigChangeWithRestart('disableLoopbackDetector', v)
          }}
        />
      </SettingItem>
      {platform == 'linux' && (
        <SettingItem title="禁用 nftables" divider>
          <Switch
            size="sm"
            isSelected={disableNftables}
            onValueChange={(v) => {
              handleConfigChangeWithRestart('disableNftables', v)
            }}
          />
        </SettingItem>
      )}
      <SettingItem title="可信路径">
        <Switch
          size="sm"
          isSelected={safePathsInput.length > 0}
          onValueChange={(v) => {
            if (!v) {
              setSafePathsInput([])
              handleConfigChangeWithRestart('safePaths', [])
            }
          }}
        />
      </SettingItem>
      {safePathsInput.length > 0 && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
          <div className="ml-2 text-sm">
            <SettingItem title="可信路径列表">
              {safePathsInput.join('') != safePaths.join('') && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => {
                    handleConfigChangeWithRestart('safePaths', safePathsInput)
                  }}
                >
                  确认
                </Button>
              )}
            </SettingItem>
            <div className="text-xs text-foreground-500 bg-content3 rounded-lg p-2 mt-1">
              <div className="ml-6">
                <EditableList
                  items={safePathsInput}
                  onChange={(items) => setSafePathsInput(items as string[])}
                  divider={false}
                  inputClassNames={secondaryInputClassNames}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingCard>
  )
}

export default EnvSetting
