import { Modal, ModalContent, ModalHeader, ModalBody, Button } from '@heroui/react'
import React from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { IoCopy } from 'react-icons/io5'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'

interface Props {
  log: ControllerLog & { time?: string }
  onClose: () => void
}

const LogDetailModal: React.FC<Props> = (props) => {
  const { log, onClose } = props
  const {
    appConfig: {
      disableAnimation = false,
      collapseSidebar = false,
      siderWidth = 250
    } = {}
  } = useAppConfig()

  const fullLog = `[${log.time}] [${log.type.toUpperCase()}] ${log.payload}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fullLog)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-danger/10 text-danger border-danger/20'
      case 'warning': return 'bg-warning/10 text-warning border-warning/20'
      case 'info': return 'bg-primary/10 text-primary border-primary/20'
      default: return 'bg-default/10 text-default-500 border-default/20'
    }
  }

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={createSecondaryModalClassNames()}
      size="2xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 800 })}>
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">日志详情</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="flat"
              startContent={<IoCopy className="text-xs" />}
              className="app-nodrag min-w-0 px-3 h-7 bg-default-100/50 hover:bg-default-200/50 text-xs"
              onPress={handleCopy}
            >
              复制
            </Button>
            <SecondaryModalCloseButton onPress={onClose} className="h-7 w-7 min-w-7" />
          </div>
        </ModalHeader>
        <ModalBody className="p-4">
          <div className="flex flex-col gap-2">
             {/* Metadata Info */}
             <div className="flex items-center gap-2 select-text">
                <div className={`px-1.5 py-[1px] rounded-[4px] border text-[10px] font-bold uppercase tracking-wider ${getTypeColor(log.type)}`}>
                  {log.type}
                </div>
                <div className="text-[11px] font-mono text-default-500">
                  {log.time}
                </div>
             </div>

             {/* Code Block */}
             <div className="relative group">
                <div className="w-full bg-default-100/60 dark:bg-default-50/30 border border-default-200/60 dark:border-white/10 rounded-lg p-3 shadow-inner backdrop-blur-md">
                  <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-all select-text text-foreground/90 font-medium">
                    {log.payload}
                  </pre>
                </div>
             </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default LogDetailModal
