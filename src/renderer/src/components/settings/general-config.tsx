import React, { useState, useEffect } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Tooltip, Tabs, Tab, Input, Select, SelectItem } from '@heroui/react'
import useSWR from 'swr'
import {
  checkAutoRun,
  disableAutoRun,
  enableAutoRun,
  relaunchApp,
  checkUpdate,
  cancelUpdate,
  copyEnv,
  openConfigDir,
  openUWPTool
} from '@renderer/api/app'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { IoIosHelpCircle } from 'react-icons/io'
import ConfirmModal from '../base/base-confirm'
import { toast } from 'sonner'
import { platform } from '@renderer/utils/init'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { useI18n, type LanguagePreference, type TranslationKey } from '@renderer/i18n'
import { CARD_STYLES } from '@renderer/utils/card-styles'

import WebdavConfigModal from './webdav-config-modal'

import AppSwitch from '@renderer/components/base/app-switch'
const UpdaterModal = React.lazy(() => import('../updater/updater-modal'))

const emptyArray: string[] = []
const LANGUAGE_OPTIONS: {
  key: LanguagePreference
  labelKey: TranslationKey
}[] = [
  { key: 'system', labelKey: 'common.system' },
  { key: 'zh-CN', labelKey: 'common.language.zhCN' },
  { key: 'en-US', labelKey: 'common.language.enUS' }
]

const GeneralConfig: React.FC = () => {
  const isTauriHost = __ROUTEX_HOST__ === 'tauri'
  const { t, language, setLanguage } = useI18n()
  const { data: enable, mutate: mutateEnable } = useSWR('checkAutoRun', checkAutoRun)
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    silentStart = false,
    disableGPU = false,
    disableAnimation = false,
    pauseSSID,
    autoLightweight = false,
    autoLightweightMode = 'core',
    hotReloadCoreOnSave = true
  } = appConfig || {}

  const pauseSSIDArray = pauseSSID ?? emptyArray
  const [pauseSSIDInput, setPauseSSIDInput] = useState(pauseSSIDArray)

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
    return onIpc(ON.updateStatus, handleUpdateStatus)
  }, [])

  const handleCancelUpdate = async (): Promise<void> => {
    try {
      await cancelUpdate()
      setUpdateStatus({ downloading: false, progress: 0 })
    } catch {
      // ignore
    }
  }

  return (
    <>
      {openUpdate && (
        <React.Suspense fallback={null}>
          <UpdaterModal
            onClose={() => setOpenUpdate(false)}
            version={newVersion}
            releaseNotes={releaseNotes}
            updateStatus={updateStatus}
            onCancel={handleCancelUpdate}
          />
        </React.Suspense>
      )}
      {showRestartConfirm && (
        <ConfirmModal
          title={t('settings.system.restartTitle')}
          description={
            <div>
              <p>{t('settings.system.restartDescription')}</p>
            </div>
          }
          confirmText={t('settings.system.restart')}
          cancelText={t('common.cancel')}
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
      <SettingCard title={t('settings.system.title')}>
        <SettingItem title={t('settings.system.autoLaunch')} divider>
          <AppSwitch
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
        <SettingItem title={t('settings.system.silentStart')} divider>
          <AppSwitch
            size="sm"
            isSelected={silentStart}
            onValueChange={(v) => {
              patchAppConfig({ silentStart: v })
            }}
          />
        </SettingItem>
        <SettingItem title={t('settings.system.language')} divider>
          <Select
            classNames={CARD_STYLES.GLASS_SELECT}
            className="w-[190px]"
            size="sm"
            selectedKeys={new Set([language])}
            disallowEmptySelection={true}
            aria-label={t('settings.system.language')}
            onSelectionChange={(selection) => {
              const nextLanguage = selection.currentKey as LanguagePreference | undefined
              if (nextLanguage) {
                void setLanguage(nextLanguage)
              }
            }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{t(option.labelKey)}</SelectItem>
            ))}
          </Select>
        </SettingItem>
        <SettingItem title={t('settings.system.checkUpdate')} divider>
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
                  toast.success(t('settings.system.upToDate'))
                }
              } catch (e) {
                const errorMsg = String(e)
                if (errorMsg.includes('404')) {
                  toast.error(t('settings.system.checkFailed'), {
                    description: t('settings.system.noUpdate')
                  })
                } else {
                  toast.error(String(e))
                }
              } finally {
                setCheckingUpdate(false)
              }
            }}
          >
            {t('settings.system.checkNow')}
          </Button>
        </SettingItem>

        {!isTauriHost && (
          <SettingItem
            title={t('settings.system.disableGpu')}
            actions={
              <Tooltip content={t('settings.system.disableGpuHelp')}>
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <AppSwitch
              size="sm"
              isSelected={pendingDisableGPU}
              onValueChange={(v) => {
                setPendingDisableGPU(v)
                setShowRestartConfirm(true)
              }}
            />
          </SettingItem>
        )}
        <SettingItem
          title={t('settings.system.disableAnimation')}
          actions={
            <Tooltip content={t('settings.system.disableAnimationHelp')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
        >
          <AppSwitch
            size="sm"
            isSelected={disableAnimation}
            onValueChange={(v) => {
              patchAppConfig({ disableAnimation: v })
            }}
          />
        </SettingItem>
      </SettingCard>

      <SettingCard title={t('settings.clash.title')}>
        <SettingItem title={t('settings.clash.openConfigDir')} divider>
          <Button
            size="sm"
            variant="flat"
            onPress={async () => {
              try {
                await openConfigDir()
              } catch (e) {
                toast.error(String(e))
              }
            }}
          >
            {t('settings.clash.openDir')}
          </Button>
        </SettingItem>
        <SettingItem
          title={t('settings.clash.autoLightweight')}
          actions={
            <Tooltip content={t('settings.clash.autoLightweightHelp')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <AppSwitch
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
              <SettingItem title={t('settings.clash.lightweightBehavior')} divider>
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
                  <Tab key="core" title={t('settings.clash.keepCore')} />
                  <Tab key="tray" title={t('settings.clash.closeRenderer')} />
                </Tabs>
              </SettingItem>
              <SettingItem title={t('settings.clash.lightweightDelay')} divider>
                <Input
                  size="sm"
                  className="w-[100px]"
                  classNames={{
                    input: 'bg-transparent',
                    inputWrapper:
                      'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
                  }}
                  type="number"
                  endContent={t('settings.clash.seconds')}
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
        <SettingItem title={t('settings.clash.copyTerminalProxy')} divider>
          <Button
            size="sm"
            variant="flat"
            onPress={() => {
              const type = platform === 'win32' ? 'powershell' : 'bash'
              copyEnv(type)
            }}
          >
            {t('settings.clash.copyCommand')}
          </Button>
        </SettingItem>
        {platform === 'win32' && (
          <SettingItem title={t('settings.clash.uwpTools')} divider>
            <Button size="sm" variant="flat" onPress={() => openUWPTool()}>
              {t('settings.clash.openTools')}
            </Button>
          </SettingItem>
        )}

        <SettingItem
          title={t('settings.clash.hotReloadOnSave')}
          actions={
            <Tooltip content={t('settings.clash.hotReloadOnSaveHelp')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <AppSwitch
            size="sm"
            isSelected={hotReloadCoreOnSave}
            onValueChange={(v) => {
              patchAppConfig({ hotReloadCoreOnSave: v })
            }}
          />
        </SettingItem>
        <SettingItem title={t('settings.clash.pauseBySsid')} divider>
          <div className="flex items-center gap-2">
            {pauseSSIDInput.join('') !== pauseSSIDArray.join('') && (
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  patchAppConfig({ pauseSSID: pauseSSIDInput })
                }}
              >
                {t('common.confirm')}
              </Button>
            )}
            <Input
              size="sm"
              className="w-[200px]"
              classNames={{
                input: 'bg-transparent',
                inputWrapper:
                  'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
              }}
              placeholder={t('settings.clash.ssidPlaceholder')}
              value={pauseSSIDInput.join(',')}
              onValueChange={(v) => {
                setPauseSSIDInput(v ? v.split(',').map((s) => s.trim()) : [])
              }}
            />
          </div>
        </SettingItem>
        <SettingItem title={t('settings.clash.webdav')}>
          <Button size="sm" variant="flat" onPress={() => setIsWebdavModalOpen(true)}>
            {t('settings.clash.syncConfig')}
          </Button>
        </SettingItem>
        <WebdavConfigModal isOpen={isWebdavModalOpen} onOpenChange={setIsWebdavModalOpen} />
      </SettingCard>
    </>
  )
}

export default GeneralConfig
