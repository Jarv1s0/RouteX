import { Button, Select, SelectItem, Switch, Tab, Tabs, Chip } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import ConfirmModal, { ConfirmButton } from '@renderer/components/base/base-confirm'
import PermissionModal from '@renderer/components/mihomo/permission-modal'
import ServiceModal from '@renderer/components/mihomo/service-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import PortSetting from '@renderer/components/mihomo/port-setting'
import { CARD_STYLES } from '@renderer/utils/card-styles'

import { platform } from '@renderer/utils/init'
import { IoMdCloudDownload } from 'react-icons/io'
import PubSub from 'pubsub-js'
import { relaunchApp, notDialogQuit } from '@renderer/api/app'
import {
  checkMihomoLatestVersion,
  ensureMihomoCoreAvailable,
  mihomoUpgrade,
  mihomoVersion,
  restartCore
} from '@renderer/utils/mihomo-ipc'
import {
  manualGrantCorePermition,
  revokeCorePermission,
  deleteElevateTask,
  checkElevateTask,
  installService,
  uninstallService,
  startService,
  stopService,
  initService,
  restartService
} from '@renderer/utils/service-ipc'
import React, { useState, useEffect } from 'react'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'
import useSWR from 'swr'
import { notifyError, notifyInfo, notifySuccess } from '@renderer/utils/notify'

const Mihomo: React.FC = () => {
  const isTauriHost = __ROUTEX_HOST__ === 'tauri'
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo', corePermissionMode = 'elevated' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { ipv6 } = controledMihomoConfig || {}

  const { data: version } = useSWR('mihomoVersion', mihomoVersion, {
    revalidateIfStale: false,
    revalidateOnMount: false
  })
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [showGrantConfirm, setShowGrantConfirm] = useState(false)
  const [showUnGrantConfirm, setShowUnGrantConfirm] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [pendingPermissionMode, setPendingPermissionMode] = useState<string>('')

  // 检查最新版本
  useEffect(() => {
    setLatestVersion(null)
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const isAlpha = core === 'mihomo-alpha'
        const latest = await checkMihomoLatestVersion(isAlpha)
        if (!cancelled) {
          setLatestVersion(latest)
        }
      })()
    }, 2500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [core])

  // 比较版本号，判断是否有新版本
  const hasNewVersion = (): boolean => {
    if (!version?.version || !latestVersion) return false

    // Alpha 版本使用 Hash 匹配
    if (core === 'mihomo-alpha') {
      return !version.version.includes(latestVersion)
    }

    // Stable 版本使用语义化比较
    const current = version.version.replace(/^v/, '')
    const latest = latestVersion.replace(/^v/, '')
    return current !== latest && latest > current
  }

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await patchAppConfig({ [key]: value })
      await restartCore()
      PubSub.publish('mihomo-core-changed')
    } catch (e) {
      notifyError(e)
    }
  }

  const handleCoreUpgrade = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgrade()
      setTimeout(() => PubSub.publish('mihomo-core-changed'), 2000)
    } catch (e) {
      if (typeof e === 'string' && e.includes('already using latest version')) {
        notifyInfo('已经是最新版本')
      } else {
        notifyError(e)
      }
    } finally {
      setUpgrading(false)
    }
  }

  const handleCoreChange = async (newCore: 'mihomo' | 'mihomo-alpha'): Promise<void> => {
    try {
      if (newCore === 'mihomo-alpha') {
        await ensureMihomoCoreAvailable(newCore)
      }
      await handleConfigChangeWithRestart('core', newCore)
    } catch (e) {
      notifyError(e)
    }
  }

  const handlePermissionModeChange = async (key: string): Promise<void> => {
    if (platform === 'win32') {
      if (key !== 'elevated') {
        if (await checkElevateTask()) {
          setPendingPermissionMode(key)
          setShowUnGrantConfirm(true)
        } else {
          await handleConfigChangeWithRestart('corePermissionMode', key as 'elevated' | 'service')
        }
      } else if (key === 'elevated') {
        setPendingPermissionMode(key)
        setShowGrantConfirm(true)
      }
    } else {
      await handleConfigChangeWithRestart('corePermissionMode', key as 'elevated' | 'service')
    }
  }

  const unGrantButtons: ConfirmButton[] = [
    {
      key: 'cancel',
      text: '取消',
      variant: 'light',
      onPress: () => {}
    },
    {
      key: 'confirm',
      text: platform === 'win32' ? '不重启取消' : '确认撤销',
      color: 'warning',
      onPress: async () => {
        try {
          if (platform === 'win32') {
            await deleteElevateTask()
            notifySuccess('任务计划已取消注册')
          } else {
            await revokeCorePermission()
            notifySuccess('内核权限已撤销')
          }
          await patchAppConfig({
            corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
          })

          await restartCore()
        } catch (e) {
          notifyError(e)
        }
      }
    },
    ...(platform === 'win32'
      ? [
          {
            key: 'cancel-and-restart',
            text: '取消并重启',
            color: 'danger' as const,
            onPress: async () => {
              try {
                await deleteElevateTask()
                notifySuccess('任务计划已取消注册')
                await patchAppConfig({
                  corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
                })
                await relaunchApp()
              } catch (e) {
                notifyError(e)
              }
            }
          }
        ]
      : [])
  ]

  return (
    <BasePage title="内核设置">
      {showGrantConfirm && (
        <ConfirmModal
          onChange={setShowGrantConfirm}
          title="确认使用任务计划？"
          description="确认后将退出应用，请手动使用管理员运行一次程序"
          onConfirm={async () => {
            await patchAppConfig({
              corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
            })
            await notDialogQuit()
          }}
        />
      )}
      {showUnGrantConfirm && (
        <ConfirmModal
          onChange={setShowUnGrantConfirm}
          title="确认取消任务计划？"
          description="取消任务计划后，虚拟网卡等功能可能无法正常工作。确定要继续吗？"
          buttons={unGrantButtons}
        />
      )}
      {showPermissionModal && (
        <PermissionModal
          onChange={setShowPermissionModal}
          onRevoke={async () => {
            if (platform === 'win32') {
              await deleteElevateTask()
              notifySuccess('任务计划已取消注册')
            } else {
              await revokeCorePermission()
              notifySuccess('内核权限已撤销')
            }
            await restartCore()
          }}
          onGrant={async () => {
            await manualGrantCorePermition()
            notifySuccess('内核授权成功')
            await restartCore()
          }}
        />
      )}
      {showServiceModal && (
        <ServiceModal
          onChange={setShowServiceModal}
          onInit={async () => {
            await initService()
            notifySuccess('服务初始化成功')
          }}
          onInstall={async () => {
            await installService()
            notifySuccess('服务安装成功')
          }}
          onUninstall={async () => {
            await uninstallService()
            notifySuccess('服务卸载成功')
          }}
          onStart={async () => {
            await startService()
            notifySuccess('服务启动成功')
          }}
          onRestart={async () => {
            await restartService()
            notifySuccess('服务重启成功')
          }}
          onStop={async () => {
            await stopService()
            notifySuccess('服务停止成功')
          }}
        />
      )}
      <div className="p-2 flex flex-col gap-2">
        <SettingCard>
          <SettingItem
            title={
              <div className="flex items-center gap-2">
                <span>内核版本</span>
                {hasNewVersion() && (
                  <Chip size="sm" color="success" variant="flat">
                    新版本 {latestVersion}
                  </Chip>
                )}
              </div>
            }
            actions={
              core === 'mihomo' || core === 'mihomo-alpha' ? (
                <Button
                  size="sm"
                  isIconOnly
                  aria-label="升级内核"
                  title="升级内核"
                  variant="light"
                  isLoading={upgrading}
                  onPress={handleCoreUpgrade}
                >
                  <IoMdCloudDownload className="text-lg" />
                </Button>
              ) : null
            }
            divider
          >
            <Select
              aria-label="选择内核版本"
              classNames={{
                trigger:
                  'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl data-[hover=true]:bg-default-200/50'
              }}
              className="w-[150px]"
              size="sm"
              selectedKeys={new Set([core])}
              disallowEmptySelection={true}
              onSelectionChange={(v) => handleCoreChange(v.currentKey as 'mihomo' | 'mihomo-alpha')}
            >
              <SelectItem key="mihomo">Mihomo</SelectItem>
              <SelectItem key="mihomo-alpha">Mihomo Alpha</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title="运行模式" divider>
            <Tabs
              aria-label="选择内核运行模式"
              classNames={CARD_STYLES.GLASS_TABS}
              selectedKey={corePermissionMode}
              disabledKeys={isTauriHost ? [] : ['service']}
              onSelectionChange={(key) => handlePermissionModeChange(key as string)}
            >
              <Tab key="elevated" title={platform === 'win32' ? '任务计划' : '授权运行'} />
              <Tab key="service" title="系统服务" />
            </Tabs>
          </SettingItem>
          <SettingItem title={platform === 'win32' ? '任务状态' : '授权状态'} divider>
            <Button
              size="sm"
              color="primary"
              aria-label={platform === 'win32' ? '管理任务状态' : '管理授权状态'}
              onPress={() => setShowPermissionModal(true)}
            >
              管理
            </Button>
          </SettingItem>
          <SettingItem title="服务状态" divider>
            <Button
              size="sm"
              color="primary"
              aria-label="管理服务状态"
              onPress={() => setShowServiceModal(true)}
            >
              管理
            </Button>
          </SettingItem>
          <SettingItem title="IPv6">
            <Switch
              aria-label="切换 IPv6"
              size="sm"
              isSelected={ipv6}
              onValueChange={(v) => onChangeNeedRestart({ ipv6: v })}
            />
          </SettingItem>
        </SettingCard>
        <PortSetting />
        <ControllerSetting />
        <EnvSetting />
        <AdvancedSetting />
      </div>
    </BasePage>
  )
}

export default Mihomo
