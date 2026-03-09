import React, { useEffect, useState, useRef, KeyboardEvent } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Select, SelectItem, Switch, Tab, Tabs, Tooltip, RadioGroup, Radio, Input } from '@heroui/react'
import { BiSolidFileImport } from 'react-icons/bi'
import {
  applyTheme,
  closeFloatingWindow,
  closeTrayIcon,
  fetchThemes,
  getFilePath,
  importThemes,
  relaunchApp,
  resolveThemes,
  setDockVisible,
  showFloatingWindow,
  showTrayIcon,
  startMonitor,
  writeTheme,
  registerShortcut
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { useTheme } from 'next-themes'
import { IoIosHelpCircle, IoMdCloudDownload } from 'react-icons/io'
import { MdEditDocument } from 'react-icons/md'
import CSSEditorModal from './css-editor-modal'
import { secondaryInputClassNames } from './advanced-settings'

const keyMap = {
  Backquote: '`',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Equal: '=',
  Minus: '-',
  Plus: 'PLUS',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Backspace: 'Backspace',
  CapsLock: 'Capslock',
  ContextMenu: 'Contextmenu',
  Space: 'Space',
  Tab: 'Tab',
  Convert: 'Convert',
  Delete: 'Delete',
  End: 'End',
  Help: 'Help',
  Home: 'Home',
  PageDown: 'Pagedown',
  PageUp: 'Pageup',
  Escape: 'Esc',
  PrintScreen: 'Printscreen',
  ScrollLock: 'Scrolllock',
  Pause: 'Pause',
  Insert: 'Insert',
  Suspend: 'Suspend'
}

const titleMap = {
  sysproxyCardStatus: '系统代理',
  tunCardStatus: '虚拟网卡',
  profileCardStatus: '订阅管理',
  proxyCardStatus: '代理组',
  ruleCardStatus: '规则',
  overrideCardStatus: '覆写',
  connectionCardStatus: '连接',
  mihomoCoreCardStatus: '内核',
  dnsCardStatus: 'DNS',
  sniffCardStatus: '域名嗅探',
  logCardStatus: '日志',
  substoreCardStatus: 'Sub-Store',
  statsCardStatus: '统计',
  toolsCardStatus: '工具'
}

const SiderConfigContent: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    enableSiderConfig = true,
    sysproxyCardStatus = 'col-span-1',
    tunCardStatus = 'col-span-1',
    profileCardStatus = 'col-span-2',
    proxyCardStatus = 'col-span-2',
    ruleCardStatus = 'col-span-1',
    overrideCardStatus = 'col-span-1',
    connectionCardStatus = 'col-span-2',
    mihomoCoreCardStatus = 'col-span-2',
    dnsCardStatus = 'col-span-1',
    sniffCardStatus = 'col-span-1',
    logCardStatus = 'col-span-1',
    substoreCardStatus = 'col-span-1',
    statsCardStatus = 'col-span-1',
    toolsCardStatus = 'col-span-1'
  } = appConfig || {}

  const cardStatus = {
    sysproxyCardStatus,
    tunCardStatus,
    profileCardStatus,
    proxyCardStatus,
    ruleCardStatus,
    overrideCardStatus,
    connectionCardStatus,
    mihomoCoreCardStatus,
    dnsCardStatus,
    sniffCardStatus,
    logCardStatus,
    substoreCardStatus,
    statsCardStatus,
    toolsCardStatus
  }

  return (
    <>
      <SettingItem title="启用侧边栏设置" divider>
        <Switch
          size="sm"
          isSelected={enableSiderConfig}
          onValueChange={async (v) => {
            await patchAppConfig({ enableSiderConfig: v })
          }}
        />
      </SettingItem>
      {enableSiderConfig && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
          <div className="ml-2">
            {Object.keys(cardStatus).map((key, index, array) => {
              return (
                <div key={key}>
                  <SettingItem title={titleMap[key]}>
                    <RadioGroup
                      orientation="horizontal"
                      value={cardStatus[key]}
                      onValueChange={(v) => {
                        patchAppConfig({ [key]: v as CardStatus })
                      }}
                    >
                      <Radio value="col-span-2">大</Radio>
                      <Radio value="col-span-1">小</Radio>
                      <Radio value="hidden">隐藏</Radio>
                    </RadioGroup>
                  </SettingItem>
                  {index !== array.length - 1 && <div className="border-b border-divider my-2" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

const ShortcutInput: React.FC<{
  value: string
  action: string
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
}> = (props) => {
  const { value, action, patchAppConfig } = props
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const parseShortcut = (
    event: KeyboardEvent,
    setKey: { (value: React.SetStateAction<string>): void; (arg0: string): void }
  ): void => {
    event.preventDefault()
    let code = event.code
    const key = event.key
    if (code === 'Backspace') {
      setKey('')
    } else {
      let newValue = ''
      if (event.ctrlKey) {
        newValue = 'Ctrl'
      }
      if (event.shiftKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`
      }
      if (event.metaKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${platform === 'darwin' ? 'Command' : 'Super'}`
      }
      if (event.altKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`
      }
      if (code.startsWith('Key')) {
        code = code.substring(3)
      } else if (code.startsWith('Digit')) {
        code = code.substring(5)
      } else if (code.startsWith('Arrow')) {
        code = code.substring(5)
      } else if (key.startsWith('Arrow')) {
        code = key.substring(5)
      } else if (code.startsWith('Intl')) {
        code = code.substring(4)
      } else if (code.startsWith('Numpad')) {
        if (key.length === 1) {
          code = 'Num' + code.substring(6)
        } else {
          code = key
        }
      } else if (/F\d+/.test(code)) {
        // f1-f12
      } else if (keyMap[code] !== undefined) {
        code = keyMap[code]
      } else {
        code = ''
      }
      setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`)
    }
  }
  return (
    <>
      {inputValue !== value && (
        <Button
          color="primary"
          className="mr-2"
          size="sm"
          onPress={async () => {
            try {
              if (await registerShortcut(value, inputValue, action)) {
                await patchAppConfig({ [action]: inputValue })
                window.electron.ipcRenderer.send('updateTrayMenu')
              } else {
                alert('快捷键注册失败')
              }
            } catch (e) {
              alert(`快捷键注册失败：${e}`)
            }
          }}
        >
          确认
        </Button>
      )}
      <Input
        placeholder="点击输入快捷键"
        onKeyDown={(e: KeyboardEvent): void => {
          parseShortcut(e, setInputValue)
        }}
        size="sm"
        onClear={() => setInputValue('')}
        value={inputValue}
        className="w-[calc(100%-72px)] pr-0"
        classNames={secondaryInputClassNames}
      />
    </>
  )
}

const ShortcutConfigContent: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    enableShortcutConfig = true,
    showWindowShortcut = '',
    showFloatingWindowShortcut = '',
    triggerSysProxyShortcut = '',
    triggerTunShortcut = '',
    ruleModeShortcut = '',
    globalModeShortcut = '',
    directModeShortcut = '',
    quitWithoutCoreShortcut = '',
    restartAppShortcut = ''
  } = appConfig || {}

  return (
    <>
      <SettingItem title="启用快捷键设置" divider>
        <Switch
          size="sm"
          isSelected={enableShortcutConfig}
          onValueChange={async (v) => {
            await patchAppConfig({ enableShortcutConfig: v })
          }}
        />
      </SettingItem>
      {enableShortcutConfig && (
        <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
          <div className="ml-2">
            <SettingItem title="打开/关闭窗口">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={showWindowShortcut}
                  patchAppConfig={patchAppConfig}
                  action="showWindowShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="打开/关闭悬浮窗">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={showFloatingWindowShortcut}
                  patchAppConfig={patchAppConfig}
                  action="showFloatingWindowShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="打开/关闭系统代理">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={triggerSysProxyShortcut}
                  patchAppConfig={patchAppConfig}
                  action="triggerSysProxyShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="打开/关闭虚拟网卡">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={triggerTunShortcut}
                  patchAppConfig={patchAppConfig}
                  action="triggerTunShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="切换规则模式">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={ruleModeShortcut}
                  patchAppConfig={patchAppConfig}
                  action="ruleModeShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="切换全局模式">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={globalModeShortcut}
                  patchAppConfig={patchAppConfig}
                  action="globalModeShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="切换直连模式">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={directModeShortcut}
                  patchAppConfig={patchAppConfig}
                  action="directModeShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="保留内核退出">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={quitWithoutCoreShortcut}
                  patchAppConfig={patchAppConfig}
                  action="quitWithoutCoreShortcut"
                />
              </div>
            </SettingItem>
            <div className="border-b border-divider my-2" />
            <SettingItem title="重启应用">
              <div className="flex justify-end w-[60%]">
                <ShortcutInput
                  value={restartAppShortcut}
                  patchAppConfig={patchAppConfig}
                  action="restartAppShortcut"
                />
              </div>
            </SettingItem>
          </div>
        </div>
      )}
    </>
  )
}

const AppearanceConfig: React.FC = () => {
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
    useWindowFrame = false,
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
      <SettingCard title="外观设置">
        <SettingItem
          title="显示悬浮窗"
          actions={
            <Tooltip content="未禁用GPU加速的情况下，悬浮窗可能会导致应用崩溃">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Switch
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
                  if (localShowFloating) {
                    await patchAppConfig({ showFloatingWindow: v })
                  }
                  timeoutRef.current = null
                }, 1000)
              } else {
                patchAppConfig({ showFloatingWindow: v })
                await closeFloatingWindow()
              }
            }}
          />
        </SettingItem>
        {localShowFloating && (
          <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
            <div className="ml-2">
              <SettingItem title="根据网速旋转悬浮窗图标" divider>
              <Switch
                size="sm"
                isSelected={spinFloatingIcon}
                onValueChange={async (v) => {
                  await patchAppConfig({ spinFloatingIcon: v })
                  window.electron.ipcRenderer.send('updateFloatingWindow')
                }}
              />
            </SettingItem>
            <SettingItem title="禁用托盘图标" divider>
              <Switch
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
            </div>
          </div>
        )}
        {platform !== 'linux' && (
          <>
            <SettingItem title="托盘菜单显示节点信息" divider>
              <Switch
                size="sm"
                isSelected={proxyInTray}
                onValueChange={async (v) => {
                  await patchAppConfig({ proxyInTray: v })
                }}
              />
            </SettingItem>
            <SettingItem
              title={`${platform === 'win32' ? '任务栏' : '状态栏'}显示网速信息`}
              divider
            >
              <Switch
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
          <div className="text-sm text-foreground-600 bg-content2 rounded-lg p-1 mt-2 mb-4">
            <div className="ml-2">
              <SettingItem title="显示 Dock 图标" divider>
              <Switch
                size="sm"
                isSelected={useDockIcon}
                onValueChange={async (v) => {
                  await patchAppConfig({ useDockIcon: v })
                  setDockVisible(v)
                }}
              />
            </SettingItem>
            </div>
          </div>
        )}
        <SettingItem title="使用系统标题栏" divider>
          <Switch
            size="sm"
            isSelected={useWindowFrame}
            onValueChange={async (v) => {
              await patchAppConfig({ useWindowFrame: v })
              await relaunchApp()
            }}
          />
        </SettingItem>
        <SiderConfigContent />
        <ShortcutConfigContent />
        <SettingItem title="背景色" divider>
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
            <Tab key="system" title="自动" />
            <Tab key="dark" title="深色" />
            <Tab key="light" title="浅色" />
          </Tabs>
        </SettingItem>
        <SettingItem
          title="主题"
          actions={
            <>
              <Button
                size="sm"
                isLoading={fetching}
                isIconOnly
                title="拉取主题"
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
                title="导入主题"
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
                title="编辑主题"
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
