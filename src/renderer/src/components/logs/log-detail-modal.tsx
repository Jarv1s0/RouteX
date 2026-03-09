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
      classNames={{ 
        backdrop: 'top-[48px]',
        base: 'bg-background/80 backdrop-blur-xl border border-default-200/50 dark:border-white/10 shadow-2xl'
      }}
      size="2xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex justify-between items-center app-drag pr-3 border-b border-default-100 p-3">
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
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="app-nodrag h-7 w-7 text-default-500"
              onPress={onClose}
            >
              <IoClose className="text-lg" />
            </Button>
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
                <div className="w-full bg-[#f5f5f5] dark:bg-[#111113] border border-default-200/50 dark:border-white/5 rounded-lg p-3 shadow-inner">
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
