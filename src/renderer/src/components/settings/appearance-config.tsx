import React, { useEffect, useState, useRef } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Select, SelectItem, Tab, Tabs, Tooltip } from '@heroui/react'
import { BiSolidFileImport } from 'react-icons/bi'
import { getFilePath } from '@renderer/utils/file-ipc'
import {
  applyTheme,
  fetchThemes,
  importThemes,
  resolveThemes,
  writeTheme
} from '@renderer/utils/theme-ipc'
import {
  closeFloatingWindow,
  closeTrayIcon,
  setDockVisible,
  showFloatingWindow,
  showTrayIcon,
  startMonitor
} from '@renderer/utils/window-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { platform } from '@renderer/utils/init'
import { useTheme } from 'next-themes'
import { IoIosHelpCircle, IoMdCloudDownload } from 'react-icons/io'
import { MdEditDocument } from 'react-icons/md'
import ShortcutConfigModal from './shortcut-config-modal'
import CSSEditorModal from './css-editor-modal'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
const ShortcutConfigContent: React.FC = () => {
  const { t } = useI18n()
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false)

  return (
    <>
      <SettingItem title={t('settings.appearance.shortcutSettings')} divider>
        <Button size="sm" variant="flat" onPress={() => setIsShortcutModalOpen(true)}>
          {t('settings.appearance.configure')}
        </Button>
      </SettingItem>
      <ShortcutConfigModal isOpen={isShortcutModalOpen} onOpenChange={setIsShortcutModalOpen} />
    </>
  )
}

const AppearanceConfig: React.FC = () => {
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()
  const [customThemes, setCustomThemes] = useState<{ key: string; label: string }[]>()
  const [openCSSEditor, setOpenCSSEditor] = useState(false)
  const [fetching, setFetching] = useState(false)
  const { setTheme } = useTheme()
  const {
    useDockIcon = true,
    showTraffic = false,
    proxyInTray = true,
    disableTray = false,
    showFloatingWindow: showFloating = false,
    spinFloatingIcon = true,
    collapseSidebar = false,

    customTheme = 'default.css',
    appTheme = 'system'
  } = appConfig || {}
  const [localShowFloating, setLocalShowFloating] = useState(showFloating)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    resolveThemes().then((themes) => {
      setCustomThemes(themes)
    })
  }, [])

  useEffect(() => {
    return (): void => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setLocalShowFloating(showFloating)
  }, [showFloating])

  return (
    <>
      {openCSSEditor && (
        <CSSEditorModal
          theme={customTheme}
          onCancel={() => setOpenCSSEditor(false)}
          onConfirm={async (css: string) => {
            await writeTheme(customTheme, css)
            await applyTheme(customTheme)
            setOpenCSSEditor(false)
          }}
        />
      )}
      <SettingCard title={t('settings.appearance.title')}>
        <SettingItem
          title={t('settings.appearance.showFloating')}
          actions={
            <Tooltip content={t('settings.appearance.showFloatingHelp')}>
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <AppSwitch
            size="sm"
            isSelected={localShowFloating}
            onValueChange={async (v) => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
              }

              setLocalShowFloating(v)
              if (v) {
                await showFloatingWindow()
                timeoutRef.current = setTimeout(async () => {
                  await patchAppConfig({ showFloatingWindow: true })
                  timeoutRef.current = null
                }, 1000)
              } else {
                await patchAppConfig({ showFloatingWindow: false })
                await closeFloatingWindow()
              }
            }}
          />
        </SettingItem>
        {localShowFloating && (
          <>
            <SettingItem title={t('settings.appearance.spinFloatingIcon')} divider>
              <AppSwitch
                size="sm"
                isSelected={spinFloatingIcon}
                onValueChange={async (v) => {
                  await patchAppConfig({ spinFloatingIcon: v })
                  sendIpc(SEND.updateFloatingWindow)
                }}
              />
            </SettingItem>
            <SettingItem title={t('settings.appearance.disableTray')} divider>
              <AppSwitch
                size="sm"
                isSelected={disableTray}
                onValueChange={async (v) => {
                  await patchAppConfig({ disableTray: v })
                  if (v) {
                    closeTrayIcon()
                  } else {
                    showTrayIcon()
                  }
                }}
              />
            </SettingItem>
          </>
        )}
        {platform !== 'linux' && (
          <>
            <SettingItem title={t('settings.appearance.proxyInTray')} divider>
              <AppSwitch
                size="sm"
                isSelected={proxyInTray}
                onValueChange={async (v) => {
                  await patchAppConfig({ proxyInTray: v })
                }}
              />
            </SettingItem>
            <SettingItem
              title={t(
                platform === 'win32'
                  ? 'settings.appearance.trafficInTaskbar'
                  : 'settings.appearance.trafficInStatusbar'
              )}
              divider
            >
              <AppSwitch
                size="sm"
                isSelected={showTraffic}
                onValueChange={async (v) => {
                  await patchAppConfig({ showTraffic: v })
                  await startMonitor()
                }}
              />
            </SettingItem>
          </>
        )}
        {platform === 'darwin' && (
          <SettingItem title={t('settings.appearance.showDock')} divider>
            <AppSwitch
              size="sm"
              isSelected={useDockIcon}
              onValueChange={async (v) => {
                await patchAppConfig({ useDockIcon: v })
                setDockVisible(v)
              }}
            />
          </SettingItem>
        )}

        <SettingItem title={t('settings.appearance.collapseSidebar')} divider>
          <AppSwitch
            size="sm"
            isSelected={collapseSidebar}
            onValueChange={async (v) => {
              await patchAppConfig({ collapseSidebar: v })
            }}
          />
        </SettingItem>
        <ShortcutConfigContent />
        <SettingItem title={t('settings.appearance.background')} divider>
          <Tabs
            size="sm"
            color="primary"
            variant="solid"
            radius="lg"
            selectedKey={appTheme}
            onSelectionChange={(key) => {
              setTheme(key.toString())
              patchAppConfig({ appTheme: key as AppTheme })
            }}
          >
            <Tab key="system" title={t('common.auto')} />
            <Tab key="dark" title={t('settings.appearance.dark')} />
            <Tab key="light" title={t('settings.appearance.light')} />
          </Tabs>
        </SettingItem>
        <SettingItem
          title={t('settings.appearance.theme')}
          actions={
            <>
              <Button
                size="sm"
                isLoading={fetching}
                isIconOnly
                title={t('settings.appearance.fetchTheme')}
                variant="light"
                onPress={async () => {
                  setFetching(true)
                  try {
                    await fetchThemes()
                    setCustomThemes(await resolveThemes())
                  } catch (e) {
                    alert(e)
                  } finally {
                    setFetching(false)
                  }
                }}
              >
                <IoMdCloudDownload className="text-lg" />
              </Button>
              <Button
                size="sm"
                isIconOnly
                title={t('settings.appearance.importTheme')}
                variant="light"
                onPress={async () => {
                  const files = await getFilePath(['css'])
                  if (!files) return
                  try {
                    await importThemes(files)
                    setCustomThemes(await resolveThemes())
                  } catch (e) {
                    alert(e)
                  }
                }}
              >
                <BiSolidFileImport className="text-lg" />
              </Button>
              <Button
                size="sm"
                isIconOnly
                title={t('settings.appearance.editTheme')}
                variant="light"
                onPress={async () => {
                  setOpenCSSEditor(true)
                }}
              >
                <MdEditDocument className="text-lg" />
              </Button>
            </>
          }
        >
          {customThemes && (
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[60%]"
              size="sm"
              selectedKeys={new Set([customTheme])}
              disallowEmptySelection={true}
              onSelectionChange={async (v) => {
                try {
                  await patchAppConfig({ customTheme: v.currentKey as string })
                } catch (e) {
                  alert(e)
                }
              }}
            >
              {customThemes.map((theme) => (
                <SelectItem key={theme.key}>{theme.label}</SelectItem>
              ))}
            </Select>
          )}
        </SettingItem>
      </SettingCard>
    </>
  )
}

export default AppearanceConfig
