import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Divider
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { IoClose } from 'react-icons/io5'
import { getOverride } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

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
      classNames={{ backdrop: 'top-[48px]' }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center app-drag pr-4">
          <span>执行日志</span>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            className="app-nodrag"
            onPress={onClose}
          >
            <IoClose className="text-lg" />
          </Button>
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
