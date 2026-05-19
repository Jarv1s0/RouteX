import { Modal, ModalContent, ModalHeader, ModalBody, Button, Input, Tab, Tabs, Tooltip } from '@heroui/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getUserAgent } from '@renderer/api/app'
import { getGistUrl } from '@renderer/utils/profile-ipc'
import debounce from '@renderer/utils/debounce'
import { IoIosHelpCircle } from 'react-icons/io'
import { BiCopy } from 'react-icons/bi'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  onClose: () => void
}

const ProfileSettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    collapseSidebar = false,
    siderWidth = 250,
    profileDisplayDate = 'update',
    userAgent,
    diffWorkDir = false,
    githubToken = ''
  } = appConfig || {}

  const [ua, setUa] = useState(userAgent ?? '')
  const [defaultUserAgent, setDefaultUserAgent] = useState<string>('')
  const userAgentFetched = useRef(false)

  const setUaDebounce = debounce((v: string) => {
    patchAppConfig({ userAgent: v })
  }, 500)

  useEffect(() => {
    if (!userAgentFetched.current) {
      userAgentFetched.current = true
      getUserAgent().then((ua) => {
        setDefaultUserAgent(ua)
      })
    }
  }, [])

  useEffect(() => {
    setUa(userAgent ?? '')
  }, [userAgent])

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames()}
      size="md"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flag-emoji"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 560 })}
      >
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>{t('page.profiles.settings')}</span>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className="px-6 py-2 gap-1 pb-4 pt-0">
          <SettingItem title={t('profiles.displayDate')} divider>
            <Tabs
              size="sm"
              color="primary"
              variant="solid"
              radius="lg"
              selectedKey={profileDisplayDate}
              onSelectionChange={async (v) => {
                await patchAppConfig({
                  profileDisplayDate: v as 'expire' | 'update'
                })
              }}
            >
              <Tab key="update" title={t('profiles.updateTime')} />
              <Tab key="expire" title={t('profiles.expireTime')} />
            </Tabs>
          </SettingItem>
          <SettingItem
            title={t('profiles.diffWorkDir')}
            actions={
              <Tooltip content={t('profiles.diffWorkDirHelp')}>
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <AppSwitch
              size="sm"
              isSelected={diffWorkDir}
              onValueChange={(v) => {
                patchAppConfig({ diffWorkDir: v })
              }}
            />
          </SettingItem>
          <SettingItem title={t('profiles.userAgent')} divider>
            <Input
              size="sm"
              className="w-[60%]"
              value={ua}
              placeholder={t('connections.defaultInterval', { value: defaultUserAgent })}
              onValueChange={(v) => {
                setUa(v)
                setUaDebounce(v)
              }}
            />
          </SettingItem>
          <SettingItem
            title={t('profiles.syncGist')}
            actions={
              <Button
                title={t('profiles.copyGistUrl')}
                isIconOnly
                size="sm"
                variant="light"
                onPress={async () => {
                  try {
                    const url = await getGistUrl()
                    if (url !== '') {
                      await navigator.clipboard.writeText(`${url}/raw/routex.yaml`)
                    }
                  } catch (e) {
                    alert(e)
                  }
                }}
              >
                <BiCopy className="text-lg" />
              </Button>
            }
          >
            <Input
              type="password"
              size="sm"
              className="w-[60%]"
              value={githubToken}
              placeholder="GitHub Token"
              onValueChange={(v) => {
                patchAppConfig({ githubToken: v })
              }}
            />
          </SettingItem>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ProfileSettingModal
