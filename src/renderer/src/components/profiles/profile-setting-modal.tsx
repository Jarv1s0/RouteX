import { notifyError } from '@renderer/utils/notify'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Input,
  Tab,
  Tabs,
  Tooltip
} from '@heroui/react'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQueuedSettingSave } from '@renderer/hooks/use-queued-setting-save'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getUserAgent } from '@renderer/api/app'
import { getGistUrl } from '@renderer/utils/profile-ipc'
import { IoCheckmark, IoCopyOutline, IoEye, IoEyeOff, IoHelpCircleOutline } from 'react-icons/io5'
import { MdClose } from 'react-icons/md'
import { toast } from 'sonner'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'
import {
  MODAL_SECTION_INPUT_CLASSNAMES,
  MODAL_SECTION_TABS_CLASSNAMES,
  MODAL_SETTING_BODY_CLASSNAME,
  MODAL_SETTING_HEADER_CLASSNAME,
  MODAL_SETTING_MODAL_OVERRIDES,
  ModalSettingRow,
  ModalSettingSection
} from '@renderer/components/base/modal-setting-section'

interface Props {
  onClose: () => void
}

const ProfileSettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    collapseSidebar = false,
    siderWidth = 220,
    profileDisplayDate = 'update',
    userAgent = '',
    diffWorkDir = false,
    githubToken = ''
  } = appConfig || {}

  const [ua, setUa] = useState(userAgent ?? '')
  const [token, setToken] = useState(githubToken ?? '')
  const [showToken, setShowToken] = useState(false)
  const [gistCopied, setGistCopied] = useState(false)
  const [defaultUserAgent, setDefaultUserAgent] = useState<string>('')
  const userAgentFetched = useRef(false)

  const uaRef = useRef(ua)
  uaRef.current = ua
  const [saveUa, isSavingUa] = useQueuedSettingSave(userAgent?.trim() ?? '')
  const uaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tokenRef = useRef(token)
  tokenRef.current = token
  const [saveToken, isSavingToken] = useQueuedSettingSave(githubToken?.trim() ?? '')
  const tokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commitUa = useCallback(
    (nextRaw = uaRef.current) => {
      if (uaTimerRef.current !== null) {
        clearTimeout(uaTimerRef.current)
        uaTimerRef.current = null
      }
      saveUa(nextRaw.trim(), (userAgent) => patchAppConfig({ userAgent }))
    },
    [patchAppConfig, saveUa]
  )

  const scheduleUaSave = useCallback(
    (nextRaw: string) => {
      if (uaTimerRef.current !== null) {
        clearTimeout(uaTimerRef.current)
      }
      uaTimerRef.current = setTimeout(() => commitUa(nextRaw), 500)
    },
    [commitUa]
  )

  const commitToken = useCallback(
    (nextRaw = tokenRef.current) => {
      if (tokenTimerRef.current !== null) {
        clearTimeout(tokenTimerRef.current)
        tokenTimerRef.current = null
      }
      saveToken(nextRaw.trim(), (githubToken) => patchAppConfig({ githubToken }))
    },
    [patchAppConfig, saveToken]
  )

  const scheduleTokenSave = useCallback(
    (nextRaw: string) => {
      if (tokenTimerRef.current !== null) {
        clearTimeout(tokenTimerRef.current)
      }
      tokenTimerRef.current = setTimeout(() => commitToken(nextRaw), 500)
    },
    [commitToken]
  )

  useEffect(() => {
    if (!userAgentFetched.current) {
      userAgentFetched.current = true
      getUserAgent()
        .then((resolved) => {
          setDefaultUserAgent(resolved)
        })
        .catch(() => {
          // ignore user-agent lookup failures
        })
    }
  }, [])

  useEffect(() => {
    if (uaTimerRef.current === null && !isSavingUa()) setUa(userAgent ?? '')
  }, [userAgent, isSavingUa])

  useEffect(() => {
    if (tokenTimerRef.current === null && !isSavingToken()) setToken(githubToken ?? '')
  }, [githubToken, isSavingToken])

  useEffect(() => {
    return () => {
      if (uaTimerRef.current !== null) {
        commitUa(uaRef.current)
      }
      if (tokenTimerRef.current !== null) {
        commitToken(tokenRef.current)
      }
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [commitToken, commitUa])

  const handleCopyGistUrl = async (): Promise<void> => {
    try {
      const url = await getGistUrl()
      if (!url) {
        toast.info(t('profiles.gistUrlUnavailable'))
        return
      }
      await navigator.clipboard.writeText(`${url}/raw/routex.yaml`)
      setGistCopied(true)
      toast.success(t('common.copied'))
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null
        setGistCopied(false)
      }, 1500)
    } catch (error) {
      notifyError(error)
    }
  }

  const uaPlaceholder = defaultUserAgent
    ? t('connections.defaultInterval', { value: defaultUserAgent })
    : undefined
  const tokenToggleLabel = t(showToken ? 'profiles.hideToken' : 'profiles.showToken')

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames(MODAL_SETTING_MODAL_OVERRIDES)}
      size="md"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flag-emoji"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 580 })}
      >
        <ModalHeader className={MODAL_SETTING_HEADER_CLASSNAME}>
          <span>{t('page.profiles.settings')}</span>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className={MODAL_SETTING_BODY_CLASSNAME}>
          <ModalSettingSection>
            <ModalSettingRow title={t('profiles.displayDate')}>
              <Tabs
                aria-label={t('profiles.displayDate')}
                size="sm"
                classNames={MODAL_SECTION_TABS_CLASSNAMES}
                selectedKey={profileDisplayDate}
                onSelectionChange={async (v) => {
                  try {
                    await patchAppConfig({
                      profileDisplayDate: v as 'expire' | 'update'
                    })
                  } catch (error) {
                    notifyError(error)
                  }
                }}
              >
                <Tab key="update" title={t('profiles.updateTime')} />
                <Tab key="expire" title={t('profiles.expireTime')} />
              </Tabs>
            </ModalSettingRow>

            <ModalSettingRow
              title={t('profiles.diffWorkDir')}
              titleActions={
                <Tooltip content={t('profiles.diffWorkDirHelp')} className="max-w-[260px]">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="full"
                    aria-label={t('profiles.diffWorkDirHelp')}
                    className="h-6 w-6 min-w-6 text-default-400 hover:text-primary"
                  >
                    <IoHelpCircleOutline className="text-base" />
                  </Button>
                </Tooltip>
              }
            >
              <AppSwitch
                size="sm"
                aria-label={t('profiles.diffWorkDir')}
                isSelected={diffWorkDir}
                onValueChange={(v) => {
                  patchAppConfig({ diffWorkDir: v }).catch((error) => notifyError(error))
                }}
              />
            </ModalSettingRow>

            <ModalSettingRow title={t('profiles.userAgent')}>
              <Input
                size="sm"
                aria-label={t('profiles.userAgent')}
                className="w-full sm:w-[260px]"
                classNames={MODAL_SECTION_INPUT_CLASSNAMES}
                value={ua}
                placeholder={uaPlaceholder}
                onValueChange={(v) => {
                  setUa(v)
                  scheduleUaSave(v)
                }}
                onBlur={() => commitUa(ua)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitUa(ua)
                  }
                }}
                endContent={
                  ua.trim().length > 0 ? (
                    <Tooltip content={t('proxies.resetToDefault')}>
                      <button
                        type="button"
                        aria-label={t('proxies.resetToDefault')}
                        className="rounded-full p-0.5 text-default-400 transition-colors hover:bg-default-200/70 hover:text-foreground"
                        onClick={() => {
                          setUa('')
                          commitUa('')
                        }}
                      >
                        <MdClose className="text-sm" />
                      </button>
                    </Tooltip>
                  ) : null
                }
              />
            </ModalSettingRow>

            <ModalSettingRow
              title={t('profiles.syncGist')}
              titleActions={
                <Tooltip content={t('profiles.copyGistUrl')}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="full"
                    aria-label={t('profiles.copyGistUrl')}
                    className="h-6 w-6 min-w-6 text-default-400 hover:text-primary"
                    onPress={() => {
                      void handleCopyGistUrl()
                    }}
                  >
                    {gistCopied ? (
                      <IoCheckmark className="text-base text-success" />
                    ) : (
                      <IoCopyOutline className="text-sm" />
                    )}
                  </Button>
                </Tooltip>
              }
            >
              <Input
                type={showToken ? 'text' : 'password'}
                size="sm"
                aria-label={t('profiles.syncGist')}
                className="w-full sm:w-[260px]"
                classNames={MODAL_SECTION_INPUT_CLASSNAMES}
                value={token}
                placeholder="GitHub Token"
                onValueChange={(v) => {
                  setToken(v)
                  scheduleTokenSave(v)
                }}
                onBlur={() => commitToken(token)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitToken(token)
                  }
                }}
                endContent={
                  <button
                    type="button"
                    aria-label={tokenToggleLabel}
                    title={tokenToggleLabel}
                    className="rounded-full p-0.5 text-default-400 transition-colors hover:bg-default-200/70 hover:text-foreground"
                    onClick={() => setShowToken((prev) => !prev)}
                  >
                    {showToken ? (
                      <IoEyeOff className="text-base" />
                    ) : (
                      <IoEye className="text-base" />
                    )}
                  </button>
                }
              />
            </ModalSettingRow>
          </ModalSettingSection>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ProfileSettingModal
