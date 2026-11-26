import { applyConfigChange } from '@renderer/utils/core-restart'
import { Button, Select, SelectItem, Tab, Tabs, Chip } from '@heroui/react'
import BasePage, { FLOATING_ACTION_BUTTON_CLASS } from '@renderer/components/base/base-page'
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
import { relaunchApp, notDialogQuit, patchAppConfig as persistAppConfig } from '@renderer/api/app'
import {
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
import React, { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'
import { DnsSettingsFormFields } from '@renderer/components/dns/dns-settings-editor'
import {
  SnifferSettingsFormFields,
  useSnifferSettingsEditor
} from '@renderer/components/sniffer/sniffer-settings-editor'
import { useDnsSettingsEditor } from '@renderer/hooks/use-dns-form'
import useSWR from 'swr'
import { notifyError, notifyInfo, notifySuccess } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'
import { hasMihomoUpdate } from '@renderer/utils/mihomo-version'
import { emitMihomoCoreChanged } from '@renderer/utils/mihomo-core-events'
import { useMihomoLatestVersion } from '@renderer/hooks/use-mihomo-latest-version'
import { switchMihomoCore } from '@renderer/utils/mihomo-core-switch'

import AppSwitch from '@renderer/components/base/app-switch'

type MihomoTab = 'basic' | 'dns' | 'sniffer'

function normalizeMihomoTab(tab: string | null): MihomoTab {
  if (tab === 'dns' || tab === 'sniffer') {
    return tab
  }
  return 'basic'
}

const Mihomo: React.FC = () => {
  const { t } = useI18n()
  const isTauriHost = __ROUTEX_HOST__ === 'tauri'
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = normalizeMihomoTab(searchParams.get('tab'))
  const dnsEditor = useDnsSettingsEditor()
  const snifferEditor = useSnifferSettingsEditor()

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTab = normalizeMihomoTab(key)
      const nextParams = new URLSearchParams(searchParams)
      if (nextTab === 'basic') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', nextTab)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const activeSaveEditor =
    activeTab === 'dns' ? dnsEditor : activeTab === 'sniffer' ? snifferEditor : null
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo', corePermissionMode = 'elevated' } = appConfig || {}
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { ipv6 } = controledMihomoConfig || {}

  const { data: version } = useSWR('mihomoVersion', mihomoVersion, {
    revalidateIfStale: false,
    revalidateOnMount: false
  })
  const latestVersion = useMihomoLatestVersion(core)
  const [upgrading, setUpgrading] = useState(false)
  const [switchingCore, setSwitchingCore] = useState(false)
  const coreOperationInProgress = useRef(false)
  const [showGrantConfirm, setShowGrantConfirm] = useState(false)
  const [showUnGrantConfirm, setShowUnGrantConfirm] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [pendingPermissionMode, setPendingPermissionMode] = useState<string>('')

  const hasNewVersion = (): boolean => hasMihomoUpdate(version?.version, latestVersion, core)

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    try {
      await applyConfigChange({ core: patch, restart: true })
    } catch (error) {
      notifyError(error)
    }
  }

  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await applyConfigChange({ app: { [key]: value }, restart: true })
      emitMihomoCoreChanged()
    } catch (e) {
      notifyError(e)
    }
  }

  const handleCoreUpgrade = async (): Promise<void> => {
    if (coreOperationInProgress.current) return
    coreOperationInProgress.current = true
    try {
      setUpgrading(true)
      await mihomoUpgrade()
      setTimeout(() => emitMihomoCoreChanged(), 2000)
    } catch (e) {
      if (typeof e === 'string' && e.includes('already using latest version')) {
        notifyInfo(t('mihomo.latest'))
      } else {
        notifyError(e)
      }
    } finally {
      coreOperationInProgress.current = false
      setUpgrading(false)
    }
  }

  const handleCoreChange = async (newCore: 'mihomo' | 'mihomo-alpha'): Promise<void> => {
    if (!['mihomo', 'mihomo-alpha'].includes(newCore) || newCore === core) return
    if (coreOperationInProgress.current) return
    coreOperationInProgress.current = true
    setSwitchingCore(true)
    try {
      await switchMihomoCore(core, newCore, {
        ensureAvailable: ensureMihomoCoreAvailable,
        saveCore: (selectedCore) => persistAppConfig({ core: selectedCore }),
        restart: restartCore
      })
      emitMihomoCoreChanged()
    } catch (e) {
      emitMihomoCoreChanged()
      notifyError(e)
    } finally {
      coreOperationInProgress.current = false
      setSwitchingCore(false)
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
      text: t('common.cancel'),
      variant: 'light',
      onPress: () => {}
    },
    {
      key: 'confirm',
      text: platform === 'win32' ? t('mihomo.cancelWithoutRestart') : t('mihomo.confirmRevoke'),
      color: 'warning',
      onPress: async () => {
        try {
          if (platform === 'win32') {
            await deleteElevateTask()
            notifySuccess(t('mihomo.taskUnregistered'))
          } else {
            await revokeCorePermission()
            notifySuccess(t('mihomo.permissionRevoked'))
          }
          await applyConfigChange({
            app: { corePermissionMode: pendingPermissionMode as 'elevated' | 'service' },
            restart: true
          })
        } catch (e) {
          notifyError(e)
        }
      }
    },
    ...(platform === 'win32'
      ? [
          {
            key: 'cancel-and-restart',
            text: t('mihomo.cancelAndRestart'),
            color: 'danger' as const,
            onPress: async () => {
              try {
                await deleteElevateTask()
                notifySuccess(t('mihomo.taskUnregistered'))
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
    <BasePage
      title={t('page.mihomo.title')}
      footer={
        activeSaveEditor?.changed && (
          <Button
            size="sm"
            className={FLOATING_ACTION_BUTTON_CLASS}
            color="primary"
            isDisabled={activeSaveEditor.saveDisabled}
            isLoading={activeSaveEditor.saving}
            onPress={() => void activeSaveEditor.save()}
          >
            {t('common.save')}
          </Button>
        )
      }
    >
      {showGrantConfirm && (
        <ConfirmModal
          onChange={setShowGrantConfirm}
          title={t('mihomo.confirmTaskTitle')}
          description={t('mihomo.confirmTaskDescription')}
          onConfirm={async () => {
            try {
              await patchAppConfig({
                corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
              })
              await notDialogQuit()
            } catch (error) {
              notifyError(error)
            }
          }}
        />
      )}
      {showUnGrantConfirm && (
        <ConfirmModal
          onChange={setShowUnGrantConfirm}
          title={t('mihomo.confirmCancelTaskTitle')}
          description={t('mihomo.confirmCancelTaskDescription')}
          buttons={unGrantButtons}
        />
      )}
      {showPermissionModal && (
        <PermissionModal
          onChange={setShowPermissionModal}
          onRevoke={async () => {
            if (platform === 'win32') {
              await deleteElevateTask()
              notifySuccess(t('mihomo.taskUnregistered'))
            } else {
              await revokeCorePermission()
              notifySuccess(t('mihomo.permissionRevoked'))
            }
            await restartCore()
          }}
          onGrant={async () => {
            await manualGrantCorePermition()
            notifySuccess(t('mihomo.permissionGranted'))
            await restartCore()
          }}
        />
      )}
      {showServiceModal && (
        <ServiceModal
          onChange={setShowServiceModal}
          onInit={async () => {
            await initService()
            notifySuccess(t('mihomo.serviceInitSuccess'))
          }}
          onInstall={async () => {
            await installService()
            notifySuccess(t('mihomo.serviceInstallSuccess'))
          }}
          onUninstall={async () => {
            await uninstallService()
            notifySuccess(t('mihomo.serviceUninstallSuccess'))
          }}
          onStart={async () => {
            await startService()
            notifySuccess(t('mihomo.serviceStartSuccess'))
          }}
          onRestart={async () => {
            await restartService()
            notifySuccess(t('mihomo.serviceRestartSuccess'))
          }}
          onStop={async () => {
            await stopService()
            notifySuccess(t('mihomo.serviceStopSuccess'))
          }}
        />
      )}
      <div className="sticky top-0 z-40 w-full bg-transparent px-2 pb-2 pt-2 pointer-events-none">
        <div
          className={`w-full flex items-center gap-2 px-2 py-1.5 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}
        >
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={activeTab}
            onSelectionChange={(key) => handleTabChange(String(key))}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab key="basic" title={t('page.mihomo.basicTab')} />
            <Tab key="dns" title={t('page.mihomo.dnsTab')} />
            <Tab key="sniffer" title={t('page.mihomo.snifferTab')} />
          </Tabs>
        </div>
      </div>

      {activeTab === 'basic' && (
        <div className="px-2 pb-2 flex flex-col gap-2">
        <SettingCard>
          <SettingItem
            title={
              <div className="flex items-center gap-2">
                <span>{t('mihomo.coreVersion')}</span>
                {hasNewVersion() && (
                  <Chip size="sm" color="success" variant="flat">
                    {t('mihomo.newVersion', { version: latestVersion || '' })}
                  </Chip>
                )}
              </div>
            }
            actions={
              core === 'mihomo' || core === 'mihomo-alpha' ? (
                <Button
                  size="sm"
                  isIconOnly
                  aria-label={t('mihomo.upgradeCore')}
                  title={t('mihomo.upgradeCore')}
                  variant="light"
                  isLoading={upgrading}
                  isDisabled={switchingCore}
                  onPress={handleCoreUpgrade}
                >
                  <IoMdCloudDownload className="text-lg" />
                </Button>
              ) : null
            }
            divider
          >
            <Select
              aria-label={t('mihomo.selectCore')}
              classNames={{
                trigger:
                  'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl data-[hover=true]:bg-default-200/50'
              }}
              className="w-[150px]"
              size="sm"
              isLoading={switchingCore}
              isDisabled={switchingCore || upgrading}
              selectedKeys={new Set([core])}
              disallowEmptySelection={true}
              onSelectionChange={(v) => handleCoreChange(v.currentKey as 'mihomo' | 'mihomo-alpha')}
            >
              <SelectItem key="mihomo">Mihomo</SelectItem>
              <SelectItem key="mihomo-alpha">Mihomo Alpha</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title={t('mihomo.runMode')} divider>
            <Tabs
              aria-label={t('mihomo.selectRunMode')}
              classNames={CARD_STYLES.GLASS_TABS}
              selectedKey={corePermissionMode}
              disabledKeys={isTauriHost ? [] : ['service']}
              onSelectionChange={(key) => handlePermissionModeChange(key as string)}
            >
              <Tab
                key="elevated"
                title={platform === 'win32' ? t('mihomo.taskSchedule') : t('mihomo.authorizedRun')}
              />
              <Tab key="service" title={t('mihomo.systemService')} />
            </Tabs>
          </SettingItem>
          <SettingItem
            title={platform === 'win32' ? t('mihomo.taskStatus') : t('mihomo.permissionStatus')}
            divider
          >
            <Button
              size="sm"
              color="primary"
              aria-label={
                platform === 'win32'
                  ? t('mihomo.manageTaskStatus')
                  : t('mihomo.managePermissionStatus')
              }
              onPress={() => setShowPermissionModal(true)}
            >
              {t('common.manage')}
            </Button>
          </SettingItem>
          <SettingItem title={t('mihomo.serviceStatus')} divider>
            <Button
              size="sm"
              color="primary"
              aria-label={t('mihomo.manageServiceStatus')}
              onPress={() => setShowServiceModal(true)}
            >
              {t('common.manage')}
            </Button>
          </SettingItem>
          <SettingItem title="IPv6">
            <AppSwitch
              aria-label={t('mihomo.toggleIpv6')}
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
      )}

      {activeTab === 'dns' && (
        <div className="px-2 pb-2">
          <DnsSettingsFormFields editor={dnsEditor} />
        </div>
      )}

      {activeTab === 'sniffer' && (
        <div className="px-2 pb-2">
          <SnifferSettingsFormFields editor={snifferEditor} />
        </div>
      )}
    </BasePage>
  )
}

export default Mihomo
