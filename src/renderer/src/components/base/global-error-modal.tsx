import React, { useEffect, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Code } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { MdErrorOutline } from 'react-icons/md'

export const GlobalErrorModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [errorDetails, setErrorDetails] = useState<{ title: string; content: string }>({
    title: '',
    content: ''
  })

  useEffect(() => {
    const handleShowError = (_event: Electron.IpcRendererEvent, title: string, content: string): void => {
      setErrorDetails({ title, content })
      setIsOpen(true)
    }

    window.electron.ipcRenderer.on('show-error-modal', handleShowError)

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('show-error-modal')
    }
  }, [])

  const onClose = (): void => {
    setIsOpen(false)
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      backdrop="blur"
      placement="center"
      classNames={{
        base: `${CARD_STYLES.GLASS_CARD} border-danger/20`,
        header: "border-b border-white/10",
        footer: "border-t border-white/10",
        closeButton: "hover:bg-white/5 active:bg-white/10"
      }}
      motionProps={{
        variants: {
          enter: {
            scale: 1,
            opacity: 1,
            transition: {
              duration: 0.3,
              ease: "easeOut"
            }
          },
          exit: {
            scale: 0.95,
            opacity: 0,
            transition: {
              duration: 0.2,
              ease: "easeIn"
            }
          }
        }
      }}
      // 确保极高的层级，覆盖一切
      style={{ zIndex: 99999 }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex gap-2 items-center text-danger">
              <MdErrorOutline size={24} />
              <span>{errorDetails.title || 'Error'}</span>
            </ModalHeader>
            <ModalBody className="py-6">
              <p className="text-default-500 mb-2">发生了一个错误，请检查以下信息：</p>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 bg-default-100/50 dark:bg-default-50/20 rounded-xl border border-white/5">
                 <Code className="whitespace-pre-wrap break-all bg-transparent shadow-none">
                    {errorDetails.content}
                 </Code>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button 
                color="danger" 
                variant="light" 
                onPress={onClose}
                className="font-medium"
              >
                关闭
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
