import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Tooltip } from '@heroui/react'

import { quitApp, quitWithoutCore, resetAppConfig, openExternalUrl } from '@renderer/api/app'
import { version } from '@renderer/utils/init'
import { ROUTEX_BUILD_VARIANT } from '../../../../shared/build'
import { IoIosHelpCircle } from 'react-icons/io'
import { IoLogoGithub } from 'react-icons/io5'
import ConfirmModal from '../base/base-confirm'
import { useI18n } from '@renderer/i18n'

// 通用输入框样式，用于二级菜单中的输入框
export const secondaryInputClassNames = {
  input: 'bg-transparent text-default-900',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
}

// 数字输入框样式，隐藏上下箭头
export const numberInputClassNames = {
  input:
    'bg-transparent text-default-900 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
}

// 一级页面输入框样式
export const primaryInputClassNames = {
  input: 'bg-transparent text-default-900',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary'
}

// 一级页面数字输入框样式
export const primaryNumberInputClassNames = {
  input:
    'bg-transparent text-default-900 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary'
}

// 卡片内输入框样式（用于工具页面等卡片内的输入框）
export const cardInputClassNames = {
  input: 'bg-transparent text-default-900',
  inputWrapper:
    'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary'
}

// Select 下拉框样式
export const selectClassNames = {
  trigger: 'border border-default-200 bg-default-100 data-[hover=true]:bg-default-200'
}

import AppearanceConfig from './appearance-config'

const AdvancedSettings: React.FC = () => {
  const { t } = useI18n()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const displayVersion =
    ROUTEX_BUILD_VARIANT === 'autobuild' ? `v${version} (autobuild)` : `v${version}`

  return (
    <div className="flex flex-col gap-2">
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title={t('settings.advanced.confirmResetTitle')}
          description={<>{t('settings.advanced.confirmResetDescription')}</>}
          confirmText={t('settings.advanced.confirmDelete')}
          cancelText={t('common.cancel')}
          onConfirm={resetAppConfig}
        />
      )}
      <AppearanceConfig />

      <SettingCard title={t('settings.advanced.more')}>
        {/* WebDAV moved to GeneralConfig */}

        <SettingItem
          title={t('settings.advanced.resetApp')}
          actions={
            <Tooltip content={t('settings.advanced.resetAppHelp')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button
            size="sm"
            color="danger"
            className="bg-danger/80"
            onPress={() => setConfirmOpen(true)}
          >
            {t('settings.advanced.resetApp')}
          </Button>
        </SettingItem>

        <SettingItem
          title={t('settings.advanced.quitWithoutCore')}
          actions={
            <Tooltip content={t('settings.advanced.quitWithoutCoreHelp')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button size="sm" color="danger" className="bg-danger/80" onPress={quitWithoutCore}>
            {t('common.quit')}
          </Button>
        </SettingItem>
        <SettingItem title={t('settings.advanced.quitApp')} divider>
          <Button size="sm" color="danger" className="bg-danger/80" onPress={quitApp}>
            {t('settings.advanced.quitApp')}
          </Button>
        </SettingItem>
        <SettingItem title={t('settings.advanced.appVersion')}>
          <div className="flex items-center gap-2">
            <span className="text-default-600">{displayVersion}</span>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="text-default-500 hover:text-foreground"
              title={t('page.settings.github')}
              onPress={() => openExternalUrl('https://github.com/Jarv1s0/RouteX')}
            >
              <IoLogoGithub className="text-lg" />
            </Button>
          </div>
        </SettingItem>
      </SettingCard>
    </div>
  )
}

export default AdvancedSettings
