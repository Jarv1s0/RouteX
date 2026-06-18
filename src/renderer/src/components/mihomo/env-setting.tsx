import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/mihomo-ipc'
import EditableList from '../base/base-list-editor'
import { platform } from '@renderer/utils/init'
import { secondaryInputClassNames } from '../settings/advanced-settings'
import { useI18n } from '@renderer/i18n'
import { emitMihomoCoreChanged } from '@renderer/utils/mihomo-core-events'

import AppSwitch from '@renderer/components/base/app-switch'
const EnvSetting: React.FC = () => {
  const { t } = useI18n()
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
      emitMihomoCoreChanged()
    }
  }
  const [safePathsInput, setSafePathsInput] = useState(safePaths)

  return (
    <SettingCard title={t('mihomo.env')} collapsible>
      <SettingItem title={t('mihomo.disableSystemCA')} divider>
        <AppSwitch
          size="sm"
          isSelected={disableSystemCA}
          onValueChange={(v) => {
            handleConfigChangeWithRestart('disableSystemCA', v)
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.disableEmbedCA')} divider>
        <AppSwitch
          size="sm"
          isSelected={disableEmbedCA}
          onValueChange={(v) => {
            handleConfigChangeWithRestart('disableEmbedCA', v)
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.disableLoopbackDetector')} divider>
        <AppSwitch
          size="sm"
          isSelected={disableLoopbackDetector}
          onValueChange={(v) => {
            handleConfigChangeWithRestart('disableLoopbackDetector', v)
          }}
        />
      </SettingItem>
      {platform == 'linux' && (
        <SettingItem title={t('mihomo.disableNftables')} divider>
          <AppSwitch
            size="sm"
            isSelected={disableNftables}
            onValueChange={(v) => {
              handleConfigChangeWithRestart('disableNftables', v)
            }}
          />
        </SettingItem>
      )}
      <SettingItem title={t('mihomo.safePaths')}>
        <AppSwitch
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
            <SettingItem title={t('mihomo.safePathList')}>
              {safePathsInput.join('') != safePaths.join('') && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => {
                    handleConfigChangeWithRestart('safePaths', safePathsInput)
                  }}
                >
                  {t('common.confirm')}
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
