import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Tooltip } from '@heroui/react'

import {
  quitApp,
  quitWithoutCore,
  resetAppConfig
} from '@renderer/utils/ipc'
import { version } from '@renderer/utils/init'
import { IoIosHelpCircle } from 'react-icons/io'
import ConfirmModal from '../base/base-confirm'

// 通用输入框样式，用于二级菜单中的输入框
export const secondaryInputClassNames = {
  input: "bg-transparent text-default-900",
  inputWrapper: "border border-default-200 bg-default-50 hover:bg-default-100 data-[focus=true]:bg-default-50"
}

// 数字输入框样式，隐藏上下箭头
export const numberInputClassNames = {
  input: "bg-transparent text-default-900 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
  inputWrapper: "border border-default-200 bg-default-50 hover:bg-default-100 data-[focus=true]:bg-default-50"
}

// 一级页面输入框样式
export const primaryInputClassNames = {
  input: "bg-transparent text-default-900",
  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary"
}

// 一级页面数字输入框样式
export const primaryNumberInputClassNames = {
  input: "bg-transparent text-default-900 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary"
}

// 卡片内输入框样式（用于工具页面等卡片内的输入框）
export const cardInputClassNames = {
  input: "bg-transparent text-default-900",
  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary"
}

// Select 下拉框样式
export const selectClassNames = {
  trigger: "border border-default-200 bg-default-100 data-[hover=true]:bg-default-200"
}

import AppearanceConfig from './appearance-config'

const AdvancedSettings: React.FC = () => {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除配置？"
          description={
            <>
              ⚠️ 删除配置，
              <span className="text-red-500">操作不可撤销</span>
            </>
          }
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={resetAppConfig}
        />
      )}
      <AppearanceConfig />
      

      <SettingCard title="更多设置">
        {/* WebDAV & SubStore Moved to GeneralConfig */}

        <SettingItem
          title="重置软件"
          actions={
            <Tooltip content="删除所有配置，将软件恢复初始状态">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button size="sm" onPress={() => setConfirmOpen(true)}>
            重置软件
          </Button>
        </SettingItem>

        <SettingItem
          title="保留内核退出"
          actions={
            <Tooltip content="完全退出软件，只保留内核进程">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Button size="sm" onPress={quitWithoutCore}>
            退出
          </Button>
        </SettingItem>
        <SettingItem title="退出应用" divider>
          <Button size="sm" onPress={quitApp}>
            退出应用
          </Button>
        </SettingItem>
        <SettingItem title="应用版本">
          <div>v{version}</div>
        </SettingItem>
      </SettingCard>
    </div>
  )
}



export default AdvancedSettings
