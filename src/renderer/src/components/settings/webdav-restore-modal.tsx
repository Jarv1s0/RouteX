import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { relaunchApp } from '@renderer/api/app'
import { webdavDelete, webdavRestore } from '@renderer/utils/webdav-ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
interface Props {
  filenames: string[]
  onClose: () => void
}
const WebdavRestoreModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { filenames: names, onClose } = props
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
  const [filenames, setFilenames] = useState<string[]>(names)
  const [restoring, setRestoring] = useState(false)

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames()}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 480 })}
      >
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span className="text-sm font-semibold">{t('settings.webdav.restoreTitle')}</span>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className="py-2 px-4 gap-1.5">
          {filenames.length === 0 ? (
            <div className="flex justify-center text-sm text-default-400">{t('settings.webdav.empty')}</div>
          ) : (
            filenames.map((filename) => (
              <div className="flex gap-1.5" key={filename}>
                <Button
                  size="sm"
                  fullWidth
                  isLoading={restoring}
                  variant="flat"
                  onPress={async () => {
                    setRestoring(true)
                    try {
                      await webdavRestore(filename)
                      await relaunchApp()
                    } catch (e) {
                      alert(t('settings.webdav.restoreFailed', { error: String(e) }))
                    } finally {
                      setRestoring(false)
                    }
                  }}
                >
                  {filename}
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="min-w-8 px-2"
                  onPress={async () => {
                    try {
                      await webdavDelete(filename)
                      setFilenames(filenames.filter((name) => name !== filename))
                    } catch (e) {
                      alert(t('settings.webdav.deleteFailed', { error: String(e) }))
                    }
                  }}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              </div>
            ))
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default WebdavRestoreModal
