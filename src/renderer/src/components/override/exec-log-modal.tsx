import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Divider
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { getOverride } from '@renderer/utils/override-ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'

interface Props {
  id: string
  onClose: () => void
}

const ExecLogModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [logs, setLogs] = useState<string[]>([])

  const getLog = async (): Promise<void> => {
    setLogs((await getOverride(id, 'log')).split('\n').filter(Boolean))
  }

  useEffect(() => {
    getLog()
  }, [])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={createSecondaryModalClassNames()}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>执行日志</span>
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
