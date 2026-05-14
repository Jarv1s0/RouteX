import React, { useState, useEffect, KeyboardEvent } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input
} from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { platform } from '@renderer/utils/init'
import { registerShortcut } from '@renderer/api/app'
import { MdCheck, MdKeyboard, MdRestore } from 'react-icons/md'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const keyMap: Record<string, string> = {
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

const ShortcutInput: React.FC<{
  value: string
  action: string
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
}> = (props) => {
  const { t } = useI18n()
  const { value, action, patchAppConfig } = props
  const [inputValue, setInputValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  const parseShortcut = (event: KeyboardEvent, setKey: (v: string) => void): void => {
    event.preventDefault()
    let code = event.code
    const key = event.key
    if (code === 'Backspace') {
      setKey('')
    } else {
      const modifiers = [
        event.ctrlKey ? 'Ctrl' : '',
        event.shiftKey ? 'Shift' : '',
        event.metaKey ? (platform === 'darwin' ? 'Command' : 'Super') : '',
        event.altKey ? 'Alt' : ''
      ].filter(Boolean)

      if (code.startsWith('Key')) code = code.substring(3)
      else if (code.startsWith('Digit')) code = code.substring(5)
      else if (code.startsWith('Arrow')) code = code.substring(5)
      else if (key.startsWith('Arrow')) code = key.substring(5)
      else if (code.startsWith('Intl')) code = code.substring(4)
      else if (code.startsWith('Numpad')) code = key.length === 1 ? 'Num' + code.substring(6) : key
      else if (keyMap[code] !== undefined) code = keyMap[code]
      else if (!/F\d+/.test(code)) code = ''

      setKey([...modifiers, code].filter(Boolean).join('+'))
    }
  }

  const handleSave = async () => {
    if (await registerShortcut(value, inputValue, action)) {
      await patchAppConfig({ [action]: inputValue })
      sendIpc(SEND.updateTrayMenu)
    }
  }

  return (
    <div className="relative w-full group">
      <Input
        placeholder={t('settings.shortcut.unset')}
        onKeyDown={(e) => parseShortcut(e, setInputValue)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        size="sm"
        value={inputValue}
        endContent={
          <div className="flex items-center gap-1">
            {inputValue !== value && (
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                color="success"
                className="h-6 w-6 min-w-6"
                onPress={handleSave}
              >
                <MdCheck size={14} />
              </Button>
            )}
            {inputValue && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="h-6 w-6 min-w-6 text-default-400 hover:text-danger"
                onPress={() => setInputValue('')}
              >
                <MdRestore size={14} />
              </Button>
            )}
          </div>
        }
        classNames={{
          input: 'font-mono font-bold text-primary tracking-wide text-right pr-2 bg-transparent',
          inputWrapper:
            'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50'
        }}
        startContent={
          <MdKeyboard
            className={`text-xl transition-colors ${isFocused ? 'text-primary' : 'text-default-300'}`}
          />
        }
      />
    </div>
  )
}

const ShortcutConfigModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    collapseSidebar = false,
    siderWidth = 250,
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

  const items = [
    {
      title: t('settings.shortcut.toggleWindow'),
      action: 'showWindowShortcut',
      value: showWindowShortcut
    },
    {
      title: t('settings.shortcut.toggleFloating'),
      action: 'showFloatingWindowShortcut',
      value: showFloatingWindowShortcut
    },
    {
      title: t('settings.shortcut.toggleSysProxy'),
      action: 'triggerSysProxyShortcut',
      value: triggerSysProxyShortcut
    },
    {
      title: t('settings.shortcut.toggleTun'),
      action: 'triggerTunShortcut',
      value: triggerTunShortcut
    },
    { title: t('settings.shortcut.ruleMode'), action: 'ruleModeShortcut', value: ruleModeShortcut },
    {
      title: t('settings.shortcut.globalMode'),
      action: 'globalModeShortcut',
      value: globalModeShortcut
    },
    {
      title: t('settings.shortcut.directMode'),
      action: 'directModeShortcut',
      value: directModeShortcut
    },
    {
      title: t('settings.shortcut.quitWithoutCore'),
      action: 'quitWithoutCoreShortcut',
      value: quitWithoutCoreShortcut
    },
    {
      title: t('settings.shortcut.restartApp'),
      action: 'restartAppShortcut',
      value: restartAppShortcut
    }
  ]

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="4xl"
      backdrop="blur"
      classNames={createSecondaryModalClassNames()}
    >
      <ModalContent
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 900 })}
      >
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 py-2 px-4">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                {t('settings.shortcut.title')}
              </span>
              <span className="text-small text-default-400 font-normal">
                {t('settings.shortcut.description')}
              </span>
            </ModalHeader>
            <ModalBody className="py-2 px-4">
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <div
                    key={item.action}
                    className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-content1/50 hover:bg-content1 border border-default-100 hover:border-default-200 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <span className="whitespace-nowrap shrink-0 text-sm font-medium text-foreground-600 group-hover:text-foreground-900 transition-colors">
                      {item.title}
                    </span>
                    <div className="w-52">
                      <ShortcutInput
                        value={item.value}
                        action={item.action}
                        patchAppConfig={patchAppConfig}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ModalBody>
            <ModalFooter className="py-2 px-4">
              <Button
                color="primary"
                variant="shadow"
                onPress={onClose}
                className="font-medium px-8"
              >
                {t('common.done')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default ShortcutConfigModal
