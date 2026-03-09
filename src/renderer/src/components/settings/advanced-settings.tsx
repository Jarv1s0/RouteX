import React, { useState, useEffect } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  copyEnv,
  openUWPTool,
  patchControledMihomoConfig,
  restartCore,
  listWebdavBackups,
  webdavBackup
} from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { IoIosHelpCircle } from 'react-icons/io'

import SubStoreConfig from './substore-config'
import WebdavRestoreModal from './webdav-restore-modal'
import debounce from '@renderer/utils/debounce'
import { toast } from 'sonner'

const emptyArray: string[] = []

// 通用输入框样式，用于二级菜单中的输入框
export const secondaryInputClassNames = {
  input: "bg-transparent",
  inputWrapper: "border border-default-200 bg-default-50 hover:bg-default-100 data-[focus=true]:bg-default-50"
}

// 数字输入框样式，隐藏上下箭头
export const numberInputClassNames = {
  input: "bg-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
  inputWrapper: "border border-default-200 bg-default-50 hover:bg-default-100 data-[focus=true]:bg-default-50"
}

// 一级页面输入框样式
export const primaryInputClassNames = {
  input: "bg-transparent",
  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-lg hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary"
}

// 一级页面数字输入框样式
export const primaryNumberInputClassNames = {
  input: "bg-transparent [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-lg hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary"
}

// 卡片内输入框样式（用于工具页面等卡片内的输入框）
export const cardInputClassNames = {
  input: "bg-transparent",
  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-lg hover:bg-default-200/50 focus-within:bg-default-100/50 focus-within:ring-2 focus-within:ring-primary"
}

// Select 下拉框样式
export const selectClassNames = {
  trigger: "border border-default-200 bg-default-100 data-[hover=true]:bg-default-200"
}

const AdvancedSettings: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    controlDns = true,
    controlSniff = true,
    pauseSSID,
    autoLightweight = false,
    autoLightweightDelay = 60,
    autoLightweightMode = 'core',
    enableWebdavConfig = true,
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavDir = 'routex'
  } = appConfig || {}

  const pauseSSIDArray = pauseSSID ?? emptyArray

  const [pauseSSIDInput, setPauseSSIDInput] = useState(pauseSSIDArray)

  // WebDAV 相关状态
  const [backuping, setBackuping] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [webdav, setWebdav] = useState({ webdavUrl, webdavUsername, webdavPassword, webdavDir })

  const setWebdavDebounce = debounce(({ webdavUrl, webdavUsername, webdavPassword, webdavDir }) => {
    patchAppConfig({ webdavUrl, webdavUsername, webdavPassword, webdavDir })
  }, 500)

  const handleBackup = async (): Promise<void> => {
    setBackuping(true)
    try {
      await webdavBackup()
      toast.success('备份成功', { description: '备份文件已上传至 WebDAV' })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBackuping(false)
    }
  }

  const handleRestore = async (): Promise<void> => {
    try {
      setRestoring(true)
      const filenames = await listWebdavBackups()
      setFilenames(filenames)
      setRestoreOpen(true)
    } catch (e) {
      toast.error(`获取备份列表失败：${e}`)
    } finally {
      setRestoring(false)
    }
  }

  useEffect(() => {
    setPauseSSIDInput(pauseSSIDArray)
  }, [pauseSSIDArray])

  return (
    <SettingCard title="Clash 设置">
      <SettingItem
        title="自动开启轻量模式"
        actions={
          <Tooltip content="关闭窗口指定时间后自动进入轻量模式">
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={autoLightweight}
          onValueChange={(v) => {
            patchAppConfig({ autoLightweight: v })
          }}
        />
      </SettingItem>
      {autoLightweight && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
          <div className="ml-2 text-sm">
            <SettingItem title="轻量模式行为" divider>
            <Tabs
              size="sm"
              color="primary"
              variant="solid"
              radius="lg"
              selectedKey={autoLightweightMode}
              onSelectionChange={(v) => {
                patchAppConfig({ autoLightweightMode: v as 'core' | 'tray' })
                if (v === 'core') {
                  patchAppConfig({ autoLightweightDelay: Math.max(autoLightweightDelay, 5) })
                }
              }}
            >
              <Tab key="core" title="仅保留内核" />
              <Tab key="tray" title="仅关闭渲染进程" />
            </Tabs>
          </SettingItem>
          <SettingItem title="自动开启轻量模式延时" divider>
            <Input
              size="sm"
              className="w-[100px]"
              classNames={secondaryInputClassNames}
              type="number"
              endContent="秒"
              value={autoLightweightDelay.toString()}
              onValueChange={async (v: string) => {
                let num = parseInt(v)
                if (isNaN(num)) num = 0
                const minDelay = autoLightweightMode === 'core' ? 5 : 0
                if (num < minDelay) num = minDelay
                await patchAppConfig({ autoLightweightDelay: num })
              }}
            />
          </SettingItem>
          </div>
        </div>
      )}
      <SettingItem title="复制终端代理命令" divider>
        <Tooltip content={`复制 ${platform === 'win32' ? 'PowerShell' : 'Bash'} 代理命令`}>
          <Button
            size="sm"
            onPress={() => {
              const type = platform === 'win32' ? 'powershell' : 'bash'
              copyEnv(type)
            }}
          >
            复制命令
          </Button>
        </Tooltip>
      </SettingItem>
      {platform === 'win32' && (
        <SettingItem title="UWP 工具" divider>
          <Button size="sm" onPress={() => openUWPTool()}>
            打开
          </Button>
        </SettingItem>
      )}

      <SettingItem title="接管 DNS 设置" divider>
        <Switch
          size="sm"
          isSelected={controlDns}
          onValueChange={async (v) => {
            try {
              await patchAppConfig({ controlDns: v })
              await patchControledMihomoConfig({})
              await restartCore()
            } catch (e) {
              toast.error(String(e))
            }
          }}
        />
      </SettingItem>
      <SettingItem title="接管域名嗅探设置" divider>
        <Switch
          size="sm"
          isSelected={controlSniff}
          onValueChange={async (v) => {
            try {
              await patchAppConfig({ controlSniff: v })
              await patchControledMihomoConfig({})
              await restartCore()
            } catch (e) {
              toast.error(String(e))
            }
          }}
        />
      </SettingItem>
      <SettingItem title="在特定的 WiFi SSID 下直连" divider>
        <div className="flex items-center gap-2">
          {pauseSSIDInput.join('') !== pauseSSIDArray.join('') && (
            <Button
              size="sm"
              color="primary"
              onPress={() => {
                patchAppConfig({ pauseSSID: pauseSSIDInput })
              }}
            >
              确认
            </Button>
          )}
          <Input
            size="sm"
            className="w-[200px]"
            classNames={secondaryInputClassNames}
            placeholder="输入 SSID，逗号分隔"
            value={pauseSSIDInput.join(',')}
            onValueChange={(v) => {
              setPauseSSIDInput(v ? v.split(',').map((s) => s.trim()) : [])
            }}
          />
        </div>
      </SettingItem>
      <SubStoreConfig embedded />
      <SettingItem title="启用 WebDAV 备份">
        <Switch
          size="sm"
          isSelected={enableWebdavConfig}
          onValueChange={async (v) => {
            await patchAppConfig({ enableWebdavConfig: v })
          }}
        />
      </SettingItem>
      {enableWebdavConfig && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
          <div className="ml-2 text-sm">
            <SettingItem title="WebDAV 地址" divider>
              <Input
                size="sm"
                className="w-[60%]"
                classNames={secondaryInputClassNames}
                value={webdav.webdavUrl}
                onValueChange={(v) => {
                  setWebdav({ ...webdav, webdavUrl: v })
                  setWebdavDebounce({ ...webdav, webdavUrl: v })
                }}
              />
            </SettingItem>
            <SettingItem title="WebDAV 备份目录" divider>
              <Input
                size="sm"
                className="w-[60%]"
                classNames={secondaryInputClassNames}
                value={webdav.webdavDir}
                onValueChange={(v) => {
                  setWebdav({ ...webdav, webdavDir: v })
                  setWebdavDebounce({ ...webdav, webdavDir: v })
                }}
              />
            </SettingItem>
            <SettingItem title="WebDAV 用户名" divider>
              <Input
                size="sm"
                className="w-[60%]"
                classNames={secondaryInputClassNames}
                value={webdav.webdavUsername}
                onValueChange={(v) => {
                  setWebdav({ ...webdav, webdavUsername: v })
                  setWebdavDebounce({ ...webdav, webdavUsername: v })
                }}
              />
            </SettingItem>
            <SettingItem title="WebDAV 密码" divider>
              <Input
                size="sm"
                className="w-[60%]"
                classNames={secondaryInputClassNames}
                type="password"
                value={webdav.webdavPassword}
                onValueChange={(v) => {
                  setWebdav({ ...webdav, webdavPassword: v })
                  setWebdavDebounce({ ...webdav, webdavPassword: v })
                }}
              />
            </SettingItem>
            <div className="flex justify-between">
              <Button isLoading={backuping} fullWidth size="sm" className="mr-1" onPress={handleBackup}>
                备份
              </Button>
              <Button
                isLoading={restoring}
                fullWidth
                size="sm"
                className="ml-1"
                onPress={handleRestore}
              >
                恢复
              </Button>
            </div>
          </div>
        </div>
      )}
      {restoreOpen && (
        <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />
      )}
    </SettingCard>
  )
}

export default AdvancedSettings
