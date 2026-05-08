import React, { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Code } from '@heroui/react'
import {
  MdCheckCircleOutline,
  MdContentCopy,
  MdErrorOutline,
  MdInfoOutline,
  MdWarningAmber
} from 'react-icons/md'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
import type { DialogDetails } from './global-dialog-modal'

interface GlobalDialogContentProps {
  isOpen: boolean
  details: DialogDetails
  onClose: () => void
}

const GlobalDialogContent: React.FC<GlobalDialogContentProps> = ({ isOpen, details, onClose }) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleClose = (): void => {
    setIsCopied(false)
    onClose()
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(details.content)
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy functionality', err)
    }
  }

  const icon = (() => {
    switch (details.type) {
      case 'error':
        return <MdErrorOutline size={24} />
      case 'warning':
        return <MdWarningAmber size={24} />
      case 'success':
        return <MdCheckCircleOutline size={24} />
      case 'info':
      default:
        return <MdInfoOutline size={24} />
    }
  })()

  const colorClass = (() => {
    switch (details.type) {
      case 'error':
        return 'text-danger border-danger/20'
      case 'warning':
        return 'text-warning border-warning/20'
      case 'success':
        return 'text-success border-success/20'
      case 'info':
      default:
        return 'text-primary border-primary/20'
    }
  })()

  const [titleClass, borderClass] = colorClass.split(' ')

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      backdrop="blur"
      placement="center"
      classNames={createSecondaryModalClassNames({
        base: `${CARD_STYLES.GLASS_CARD} ${borderClass}`
      })}
      motionProps={{
        variants: {
          enter: { scale: 1, opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
          exit: { scale: 0.95, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }
        }
      }}
      style={{ zIndex: 99999 }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className={`flex gap-2 items-center ${titleClass}`}>
              {icon}
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
                color={
                  details.type === 'error'
                    ? 'danger'
                    : details.type === 'warning'
                      ? 'warning'
                      : 'primary'
                }
                variant="light"
                onPress={handleClose}
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

export default GlobalDialogContent
