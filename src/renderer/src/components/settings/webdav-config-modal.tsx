import React, { useState, useEffect, useMemo } from 'react'
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
import { webdavBackup, listWebdavBackups } from '@renderer/utils/webdav-ipc'
import { toast } from 'sonner'
import debounce from '@renderer/utils/debounce'
import WebdavRestoreModal from './webdav-restore-modal'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import { IoEye, IoEyeOff } from 'react-icons/io5'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

type WebdavField = 'webdavUrl' | 'webdavUsername' | 'webdavPassword' | 'webdavDir'
type WebdavState = Record<WebdavField, string>

const ConfigInputCard: React.FC<{
  title: string
  field: WebdavField
  value: string
  type?: string
  placeholder?: string
  endContent?: React.ReactNode
  onValueChange: (field: WebdavField, value: string) => void
}> = ({ title, field, value, type = 'text', placeholder, endContent, onValueChange }) => (
  <div className="group flex items-center justify-between gap-3 p-2 rounded-xl bg-content1/50 hover:bg-content1 border border-default-100 hover:border-default-200 transition-all duration-300 shadow-sm hover:shadow-md">
    <span className="w-[76px] font-medium text-sm text-foreground-600 group-hover:text-foreground-900 transition-colors whitespace-nowrap shrink-0">
      {title}
    </span>
    <Input
      size="sm"
      className="flex-1 min-w-0"
      type={type}
      variant="bordered"
      placeholder={placeholder}
      classNames={{
        input: 'bg-transparent text-xs',
        inputWrapper:
          'border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 h-8 min-h-8'
      }}
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
    siderWidth = 250,
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
        void patchAppConfig(patch)
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
        classNames={createSecondaryModalClassNames({ closeButton: 'top-2 right-2' })}
      >
        <ModalContent
          style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 560 })}
        >
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col py-2 px-4">
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                  {t('settings.webdav.title')}
                </span>
              </ModalHeader>
              <ModalBody className="py-2 px-4">
                <div className="flex flex-col gap-1.5">
                  <ConfigInputCard
                    title={t('settings.webdav.url')}
                    field="webdavUrl"
                    value={webdav.webdavUrl}
                    placeholder="https://example.com/webdav"
                    onValueChange={handleValueChange}
                  />
                  <ConfigInputCard
                    title={t('settings.webdav.dir')}
                    field="webdavDir"
                    value={webdav.webdavDir}
                    placeholder="routex"
                    onValueChange={handleValueChange}
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <ConfigInputCard
                      title={t('settings.webdav.username')}
                      field="webdavUsername"
                      value={webdav.webdavUsername}
                      placeholder="Username"
                      onValueChange={handleValueChange}
                    />
                    <ConfigInputCard
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

                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    <Button
                      color="primary"
                      variant="shadow"
                      isLoading={backuping}
                      onPress={handleBackup}
                      className="font-medium"
                    >
                      {t('settings.webdav.backupNow')}
                    </Button>
                    <Button
                      color="secondary"
                      variant="shadow"
                      onPress={handleOpenRestore}
                      className="font-medium"
                    >
                      {t('settings.webdav.restore')}
                    </Button>
                  </div>
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
      {restoreOpen && (
        <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />
      )}
    </>
  )
}

export default WebdavConfigModal
