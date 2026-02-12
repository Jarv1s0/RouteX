import React, { useState, useEffect } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Switch, Tooltip, Tabs, Tab, Input } from '@heroui/react'
import useSWR from 'swr'
import { 
  checkAutoRun, 
  disableAutoRun, 
  enableAutoRun, 
  relaunchApp, 
  checkUpdate, 
  cancelUpdate, 
  copyEnv, 
  openUWPTool, 
  patchControledMihomoConfig, 
  restartCore
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { IoIosHelpCircle } from 'react-icons/io'
import ConfirmModal from '../base/base-confirm'
import UpdaterModal from '../updater/updater-modal'
import { toast } from 'sonner'
import { platform } from '@renderer/utils/init'

import SubStoreConfigModal from './substore-config-modal'
import WebdavConfigModal from './webdav-config-modal'

const emptyArray: string[] = []

const GeneralConfig: React.FC = () => {
  const { data: enable, mutate: mutateEnable } = useSWR('checkAutoRun', checkAutoRun)
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    silentStart = false,
    autoCheckUpdate,
    disableGPU = false,
    disableAnimation = false,
    controlDns = true,
    controlSniff = true,
    pauseSSID,
    autoLightweight = false,
    autoLightweightDelay = 60,
    autoLightweightMode = 'core',
  } = appConfig || {}

  const pauseSSIDArray = pauseSSID ?? emptyArray
  const [pauseSSIDInput, setPauseSSIDInput] = useState(pauseSSIDArray)

  const [isSubStoreModalOpen, setIsSubStoreModalOpen] = useState(false)
  const [isWebdavModalOpen, setIsWebdavModalOpen] = useState(false)

  useEffect(() => {
    setPauseSSIDInput(pauseSSIDArray)
  }, [pauseSSIDArray])

  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [pendingDisableGPU, setPendingDisableGPU] = useState(disableGPU)

  const [newVersion, setNewVersion] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [openUpdate, setOpenUpdate] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    downloading: boolean
    progress: number
    error?: string
  }>({
    downloading: false,
    progress: 0
  })

  useEffect(() => {
    const handleUpdateStatus = (
      _: Electron.IpcRendererEvent,
      status: typeof updateStatus
    ): void => {
      setUpdateStatus(status)
    }
    window.electron.ipcRenderer.on('update-status', handleUpdateStatus)
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('update-status')
    }
  }, [])

  const handleCancelUpdate = async (): Promise<void> => {
    try {
      await cancelUpdate()
      setUpdateStatus({ downloading: false, progress: 0 })
    } catch (e) {
      // ignore
    }
  }

  return (
    <>
      {openUpdate && (
        <UpdaterModal
          onClose={() => setOpenUpdate(false)}
          version={newVersion}
          releaseNotes={releaseNotes}
          updateStatus={updateStatus}
          onCancel={handleCancelUpdate}
        />
      )}
      {showRestartConfirm && (
        <ConfirmModal
          title="确定要重启应用吗？"
          description={
            <div>
              <p>修改 GPU 加速设置需要重启应用才能生效</p>
            </div>
          }
          confirmText="重启"
          cancelText="取消"
          onChange={(open) => {
            if (!open) {
              setPendingDisableGPU(disableGPU)
            }
            setShowRestartConfirm(open)
          }}
          onConfirm={async () => {
            await patchAppConfig({ disableGPU: pendingDisableGPU })
            if (!pendingDisableGPU) {
              await patchAppConfig({ disableAnimation: false })
            }
            await relaunchApp()
          }}
        />
      )}
      <SettingCard title="系统设置">
        <SettingItem title="开机自启" divider>
          <Switch
            size="sm"
            isSelected={enable}
            onValueChange={async (v) => {
              try {
                if (v) {
                  await enableAutoRun()
                } else {
                  await disableAutoRun()
                }
              } catch (e) {
                toast.error(String(e))
              } finally {
                mutateEnable()
              }
            }}
          />
        </SettingItem>
        <SettingItem title="静默启动" divider>
          <Switch
            size="sm"
            isSelected={silentStart}
            onValueChange={(v) => {
              patchAppConfig({ silentStart: v })
            }}
          />
        </SettingItem>
        <SettingItem 
          title="检查更新" 
          divider
        >
          <Button
            size="sm"
            variant="flat"
            isLoading={checkingUpdate}
            onPress={async () => {
              try {
                setCheckingUpdate(true)
                const version = await checkUpdate()
                if (version) {
                  setNewVersion(version.version)
                  setReleaseNotes(version.releaseNotes)
                  setOpenUpdate(true)
                } else {
                  toast.success('当前已是最新版本')
                }
              } catch (e) {
                const errorMsg = String(e)
                if (errorMsg.includes('404')) {
                  toast.error('检查更新失败', { description: '暂无可用更新' })
                } else {
                  toast.error(String(e))
                }
              } finally {
                setCheckingUpdate(false)
              }
            }}
          >
            立即检查
          </Button>
        </SettingItem>

        <SettingItem
          title="禁用 GPU 加速"
          actions={
            <Tooltip content="开启后，应用将禁用 GPU 加速，可能会提高稳定性，但会降低性能">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={pendingDisableGPU}
            onValueChange={(v) => {
              setPendingDisableGPU(v)
              setShowRestartConfirm(true)
            }}
          />
        </SettingItem>
        <SettingItem
          title="禁用动画"
          actions={
            <Tooltip content="开启后，应用将减轻绝大部分动画效果，可能会提高性能">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
        >
          <Switch
            size="sm"
            isSelected={disableAnimation}
            onValueChange={(v) => {
              patchAppConfig({ disableAnimation: v })
            }}
          />
        </SettingItem>
      </SettingCard>

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
          <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-2">
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
                    patchAppConfig({ autoLightweightDelay: 1 /* delay check handled by hook */ })
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
                classNames={{
                  input: "bg-transparent",
                  inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50"
                }}
                type="number"
                endContent="秒"
                value={appConfig?.autoLightweightDelay?.toString()}
                onValueChange={async (v: string) => {
                  let num = parseInt(v)
                  if (isNaN(num)) num = 0
                  await patchAppConfig({ autoLightweightDelay: num })
                }}
              />
            </SettingItem>
            </div>
          </div>
        )}
        <SettingItem title="复制终端代理命令" divider>
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              const type = platform === 'win32' ? 'powershell' : 'bash'
              copyEnv(type)
            }}
          >
            复制命令
          </Button>
        </SettingItem>
        {platform === 'win32' && (
          <SettingItem title="UWP 工具" divider>
            <Button size="sm" variant="flat" onPress={() => openUWPTool()}>
              打开工具
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
                variant="flat"
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
              classNames={{
                input: "bg-transparent",
                inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50"
              }}
              placeholder="输入 SSID，逗号分隔"
              value={pauseSSIDInput.join(',')}
              onValueChange={(v) => {
                setPauseSSIDInput(v ? v.split(',').map((s) => s.trim()) : [])
              }}
            />
          </div>
        </SettingItem>
        <SettingItem title="Sub-Store 设置" divider>
          <Button size="sm" variant="flat" onPress={() => setIsSubStoreModalOpen(true)}>
            管理服务
          </Button>
        </SettingItem>
        <SettingItem title="WebDAV 备份设置">
          <Button size="sm" variant="flat" onPress={() => setIsWebdavModalOpen(true)}>
            同步配置
          </Button>
        </SettingItem>
        <SubStoreConfigModal isOpen={isSubStoreModalOpen} onOpenChange={setIsSubStoreModalOpen} />
        <WebdavConfigModal isOpen={isWebdavModalOpen} onOpenChange={setIsWebdavModalOpen} />
      </SettingCard>
    </>
  )
}

export default GeneralConfig
