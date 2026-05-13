import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { webdavBackup, listWebdavBackups } from '@renderer/utils/webdav-ipc'
import { toast } from 'sonner'
import debounce from '@renderer/utils/debounce'
import WebdavRestoreModal from './webdav-restore-modal'
import { createSecondaryModalClassNames, getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

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

  const [webdav, setWebdav] = useState({ webdavUrl, webdavUsername, webdavPassword, webdavDir })
  const [backuping, setBackuping] = useState(false)
  const [filenames, setFilenames] = useState<string[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)

  useEffect(() => {
    setWebdav({ webdavUrl, webdavUsername, webdavPassword, webdavDir })
  }, [isOpen])

  const debouncedPatch = debounce((patch: unknown) => patchAppConfig(patch as Partial<AppConfig>), 500)

  const handleBackup = async () => {
    setBackuping(true)
    try {
      await webdavBackup()
      toast.success(t('settings.webdav.backupSuccess'))
    } catch (e) { toast.error(String(e)) }
    finally { setBackuping(false) }
  }

  const handleOpenRestore = async () => {
    try {
      const files = await listWebdavBackups()
      setFilenames(files); setRestoreOpen(true)
    } catch (e) { toast.error(t('settings.webdav.listFailed', { error: String(e) })) }
  }

  // 辅助组件：配置项卡片
  const ConfigInputCard: React.FC<{ 
    title: string; 
    subtitle?: string; 
    field: string; 
    type?: string; 
    placeholder?: string 
  }> = ({ 
    title, 
    subtitle, 
    field, 
    type = 'text', 
    placeholder 
  }) => (
    <div className="group flex items-center justify-between gap-4 p-3 rounded-xl bg-content1/50 hover:bg-content1 border border-default-100 hover:border-default-200 transition-all duration-300 shadow-sm hover:shadow-md">
      <div className="flex flex-col gap-0.5 overflow-hidden shrink-0">
        <span className="font-medium text-foreground-600 group-hover:text-foreground-900 transition-colors whitespace-nowrap">
          {title}
        </span>
        {subtitle && (
          <span className="text-xs text-default-400 group-hover:text-default-500 transition-colors whitespace-nowrap">
            {subtitle}
          </span>
        )}
      </div>
      <Input
        size="sm" 
        className="w-64" 
        type={type}
        variant="bordered"
        placeholder={placeholder}
        classNames={{ 
          input: "bg-transparent text-xs",
          inputWrapper: "border border-default-200 bg-default-100/50 shadow-sm rounded-2xl hover:bg-default-200/50 h-8 min-h-8"
        }}
        value={webdav[field as keyof typeof webdav]}
        onValueChange={(v) => {
          const next = { ...webdav, [field]: v }
          setWebdav(next); debouncedPatch({ [field]: v })
        }}
      />
    </div>
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
        <ModalContent style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 820 })}>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 py-2 px-4">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                  {t('settings.webdav.title')}
                </span>
                <span className="text-small text-default-400 font-normal">
                  {t('settings.webdav.description')}
                </span>
              </ModalHeader>
              <ModalBody className="py-2 px-4">
                <div className="flex flex-col gap-2">
                  <ConfigInputCard 
                    title={t('settings.webdav.url')}
                    subtitle={t('settings.webdav.urlHelp')}
                    field="webdavUrl" 
                    placeholder="https://example.com/webdav"
                  />
                  <ConfigInputCard 
                    title={t('settings.webdav.dir')}
                    subtitle={t('settings.webdav.dirHelp')}
                    field="webdavDir" 
                    placeholder="routex"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <ConfigInputCard 
                      title={t('settings.webdav.username')}
                      field="webdavUsername" 
                      placeholder="Username"
                    />
                    <ConfigInputCard 
                      title={t('settings.webdav.password')}
                      field="webdavPassword" 
                      type="password"
                      placeholder="Password"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
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
      {restoreOpen && <WebdavRestoreModal filenames={filenames} onClose={() => setRestoreOpen(false)} />}
    </>
  )
}

export default WebdavConfigModal
