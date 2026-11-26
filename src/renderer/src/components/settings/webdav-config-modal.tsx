import { notifyError } from '@renderer/utils/notify'
import React, { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Input
} from '@heroui/react'
import SecondaryModalFooter from '@renderer/components/base/secondary-modal-footer'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { webdavBackup, listWebdavBackups } from '@renderer/utils/webdav-ipc'
import { toast } from 'sonner'
import debounce from '@renderer/utils/debounce'
import WebdavRestoreModal from './webdav-restore-modal'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'
import { IoCloudUploadOutline, IoCloudDownloadOutline, IoEye, IoEyeOff } from 'react-icons/io5'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

type WebdavField = 'webdavUrl' | 'webdavUsername' | 'webdavPassword' | 'webdavDir'
type WebdavState = Record<WebdavField, string>

const WebdavFieldInput: React.FC<{
  title: string
  field: WebdavField
  value: string
  type?: string
  placeholder?: string
  endContent?: React.ReactNode
  onValueChange: (field: WebdavField, value: string) => void
}> = ({ title, field, value, type = 'text', placeholder, endContent, onValueChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-foreground-700">{title}</label>
    <Input
      size="sm"
      type={type}
      placeholder={placeholder}
      aria-label={title}
      classNames={CARD_STYLES.FORM_INPUT}
      endContent={endContent}
      value={value}
      onValueChange={(nextValue) => onValueChange(field, nextValue)}
    />
  </div>
)

const WebdavConfigModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    collapseSidebar = false,
    siderWidth = 220,
    webdavUrl = '',
    webdavUsername = '',
    webdavPassword = '',
    webdavDir = 'routex'
  } = appConfig || {}

  const [webdav, setWebdav] = useState<WebdavState>({
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavDir
  })
  const [backuping, setBackuping] = useState(false)
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setWebdav({ webdavUrl, webdavUsername, webdavPassword, webdavDir })
  }, [isOpen, webdavUrl, webdavUsername, webdavPassword, webdavDir])

  const debouncedPatch = useMemo(
    () =>
      debounce((patch: Partial<AppConfig>) => {
        void patchAppConfig(patch).catch((error) => notifyError(error))
      }, 500),
    [patchAppConfig]
  )

  const handleValueChange = (field: WebdavField, value: string): void => {
    setWebdav((prev) => ({ ...prev, [field]: value }))
    debouncedPatch({ [field]: value })
  }

  const handleBackup = async () => {
    setBackuping(true)
    try {
      await webdavBackup()
      toast.success(t('settings.webdav.backupSuccess'))
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBackuping(false)
    }
  }

  const handleOpenRestore = async () => {
    try {
      const files = await listWebdavBackups()
      setFilenames(files)
      setRestoreOpen(true)
    } catch (e) {
      toast.error(t('settings.webdav.listFailed', { error: String(e) }))
    }
  }

  const passwordToggleLabel = t(
    showPassword ? 'settings.webdav.hidePassword' : 'settings.webdav.showPassword'
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="2xl"
        backdrop="blur"
        scrollBehavior="inside"
        classNames={createSecondaryModalClassNames()}
      >
        <ModalContent
          style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 540 })}
        >
          {(onClose) => (
            <>
              <ModalHeader className="px-6 py-3">
                <span className="text-base font-bold text-foreground">
                  {t('settings.webdav.title')}
                </span>
              </ModalHeader>
              <ModalBody className="px-6 pt-3 pb-2">
                <div className="flex flex-col">
                  <WebdavFieldInput
                    title={t('settings.webdav.url')}
                    field="webdavUrl"
                    value={webdav.webdavUrl}
                    placeholder="https://example.com/webdav"
                    onValueChange={handleValueChange}
                  />
                  <div className="mt-2">
                    <WebdavFieldInput
                      title={t('settings.webdav.dir')}
                      field="webdavDir"
                      value={webdav.webdavDir}
                      placeholder="routex"
                      onValueChange={handleValueChange}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <WebdavFieldInput
                      title={t('settings.webdav.username')}
                      field="webdavUsername"
                      value={webdav.webdavUsername}
                      placeholder="Username"
                      onValueChange={handleValueChange}
                    />
                    <WebdavFieldInput
                      title={t('settings.webdav.password')}
                      field="webdavPassword"
                      value={webdav.webdavPassword}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      endContent={
                        <button
                          type="button"
                          aria-label={passwordToggleLabel}
                          title={passwordToggleLabel}
                          className="text-default-400 hover:text-default-600 focus:outline-none"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? (
                            <IoEyeOff className="text-base" />
                          ) : (
                            <IoEye className="text-base" />
                          )}
                        </button>
                      }
                      onValueChange={handleValueChange}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      radius="lg"
                      isLoading={backuping}
                      startContent={!backuping ? <IoCloudUploadOutline className="text-base" /> : undefined}
                      onPress={handleBackup}
                      className="h-9 font-medium"
                    >
                      {t('settings.webdav.backupNow')}
                    </Button>
                    <Button
                      size="sm"
                      color="secondary"
                      variant="flat"
                      radius="lg"
                      startContent={<IoCloudDownloadOutline className="text-base" />}
                      onPress={handleOpenRestore}
                      className="h-9 font-medium"
                    >
                      {t('settings.webdav.restore')}
                    </Button>
                  </div>
                </div>
              </ModalBody>
              <SecondaryModalFooter confirmText={t('common.done')} onConfirm={onClose} />
            </>
          )}
        </ModalContent>
      </Modal>
      {restoreOpen && (
        <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />
      )}
    </>
  )
}

export default WebdavConfigModal
