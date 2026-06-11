import { Modal, ModalContent, ModalHeader, ModalBody, Divider } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { getOverride } from '@renderer/utils/override-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  id: string
  onClose: () => void
}

const ExecLogModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const { t } = useI18n()
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
  const [logs, setLogs] = useState<string[]>([])

  const getLog = async (): Promise<void> => {
    setLogs((await getOverride(id, 'log')).split('\n').filter(Boolean))
  }

  useEffect(() => {
    getLog()
  }, [])

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
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 720 })}
      >
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>{t('override.execLog')}</span>
          <SecondaryModalCloseButton onPress={onClose} />
        </ModalHeader>
        <ModalBody className="pb-6">
          {logs.map((log) => {
            return (
              <>
                <small className="break-all select-text">{log}</small>
                <Divider />
              </>
            )
          })}
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default ExecLogModal
