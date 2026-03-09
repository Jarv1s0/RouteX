import React, { useEffect, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Code } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { MdErrorOutline, MdInfoOutline, MdWarningAmber, MdCheckCircleOutline, MdContentCopy } from 'react-icons/md'

type DialogType = 'info' | 'error' | 'warning' | 'success'

interface DialogDetails {
  type: DialogType
  title: string
  content: string
}

export const GlobalDialogModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [details, setDetails] = useState<DialogDetails>({
    type: 'info',
    title: '',
    content: ''
  })

  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    // 监听主进程 IPC 消息
    const handleIPC = (_event: Electron.IpcRendererEvent, type: DialogType, title: string, content: string): void => {
      setDetails({ type, title, content })
      setIsOpen(true)
    }

    // 监听前端自定义事件
    const handleCustom = (event: Event): void => {
      const customEvent = event as CustomEvent
      const { type = 'error', title, content } = customEvent.detail || {}
      setDetails({ 
        type, 
        title: title || (type === 'error' ? '错误' : '提示'), 
        content: content || '' 
      })
      setIsOpen(true)
    }

    try {
        window.electron.ipcRenderer.on('show-dialog-modal', handleIPC)
        // 兼容旧的 show-error-modal，默认为 error
        window.electron.ipcRenderer.on('show-error-modal', (_e, t, c) => handleIPC(_e, 'error', t, c))
        
        window.addEventListener('show-global-dialog', handleCustom)
        // 兼容旧的 show-global-error，默认为 error
        window.addEventListener('show-global-error', (e) => {
            const detail = (e as CustomEvent).detail
            setDetails({ type: 'error', title: detail?.title || '错误', content: detail?.content || '' })
            setIsOpen(true)
        })
    } catch (e) {
        console.error('Failed to register dialog listeners', e)
    }

    return (): void => {
      try {
          window.electron.ipcRenderer.removeAllListeners('show-dialog-modal')
          window.electron.ipcRenderer.removeAllListeners('show-error-modal')
          window.removeEventListener('show-global-dialog', handleCustom)
      } catch (e) {
          // ignore
      }
    }
  }, [])

  const onClose = (): void => {
    setIsOpen(false)
    setIsCopied(false)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(details.content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy functionality', err)
    }
  }

  const getIcon = () => {
    switch (details.type) {
      case 'error': return <MdErrorOutline size={24} />
      case 'warning': return <MdWarningAmber size={24} />
      case 'success': return <MdCheckCircleOutline size={24} />
      case 'info':
      default: return <MdInfoOutline size={24} />
    }
  }

  const getColorClass = () => {
    switch (details.type) {
        case 'error': return 'text-danger border-danger/20'
        case 'warning': return 'text-warning border-warning/20'
        case 'success': return 'text-success border-success/20'
        case 'info':
        default: return 'text-primary border-primary/20'
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      backdrop="blur"
      placement="center"
      classNames={{
        base: `${CARD_STYLES.GLASS_CARD} ${getColorClass().split(' ')[1]}`,
        header: "border-b border-white/10",
        footer: "border-t border-white/10",
        closeButton: "hover:bg-white/5 active:bg-white/10"
      }}
      motionProps={{
        variants: {
            enter: { scale: 1, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
            exit: { scale: 0.95, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }
        }
      }}
      style={{ zIndex: 99999 }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className={`flex gap-2 items-center ${getColorClass().split(' ')[0]}`}>
              {getIcon()}
              <span>{details.title}</span>
            </ModalHeader>
            <ModalBody className="py-6">
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 bg-default-100/50 dark:bg-default-50/20 rounded-xl border border-white/5">
                 <Code className="whitespace-pre-wrap break-all bg-transparent shadow-none text-default-600">
                    {details.content}
                 </Code>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="light"
                onPress={handleCopy}
                className="font-medium text-default-500"
                startContent={!isCopied && <MdContentCopy size={18} />}
              >
                {isCopied ? '已复制' : '复制'}
              </Button>
              <Button 
                color={details.type === 'error' ? 'danger' : details.type === 'warning' ? 'warning' : 'primary'}
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
