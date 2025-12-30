import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { IoClose, IoCopy } from 'react-icons/io5'

interface Props {
  log: ControllerLog & { time?: string }
  onClose: () => void
}

const LogDetailModal: React.FC<Props> = (props) => {
  const { log, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()

  const fullLog = `[${log.time}] [${log.type.toUpperCase()}] ${log.payload}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fullLog)
  }

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{ backdrop: 'top-[48px]' }}
      size="2xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center app-drag pr-4">
          <span>日志详情</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="light"
              startContent={<IoCopy className="text-sm" />}
              className="app-nodrag"
              onPress={handleCopy}
            >
              复制
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="app-nodrag"
              onPress={onClose}
            >
              <IoClose className="text-lg" />
            </Button>
          </div>
        </ModalHeader>
        <ModalBody className="px-4 pt-0 pb-4">
          <div 
            className="bg-content2 rounded-lg p-4 overflow-auto max-h-[400px] app-nodrag"
            style={{ userSelect: 'text' }}
          >
            <pre className="text-sm font-mono whitespace-pre-wrap break-all select-text">
              {fullLog}
            </pre>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default LogDetailModal
