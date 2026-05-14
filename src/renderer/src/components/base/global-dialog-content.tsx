import React, { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Code
} from '@heroui/react'
import {
  MdCheckCircleOutline,
  MdContentCopy,
  MdErrorOutline,
  MdInfoOutline,
  MdWarningAmber
} from 'react-icons/md'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
import type { DialogDetails, DialogType } from './global-dialog-modal'

const DIALOG_UI: Record<
  DialogType,
  {
    buttonColor: 'danger' | 'warning' | 'primary'
    borderClass: string
    icon: React.ReactNode
    titleClass: string
  }
> = {
  error: {
    buttonColor: 'danger',
    borderClass: 'border-danger/20',
    icon: <MdErrorOutline size={24} />,
    titleClass: 'text-danger'
  },
  warning: {
    buttonColor: 'warning',
    borderClass: 'border-warning/20',
    icon: <MdWarningAmber size={24} />,
    titleClass: 'text-warning'
  },
  success: {
    buttonColor: 'primary',
    borderClass: 'border-success/20',
    icon: <MdCheckCircleOutline size={24} />,
    titleClass: 'text-success'
  },
  info: {
    buttonColor: 'primary',
    borderClass: 'border-primary/20',
    icon: <MdInfoOutline size={24} />,
    titleClass: 'text-primary'
  }
}

interface GlobalDialogContentProps {
  isOpen: boolean
  details: DialogDetails
  onClose: () => void
}

const GlobalDialogContent: React.FC<GlobalDialogContentProps> = ({ isOpen, details, onClose }) => {
  const { t } = useI18n()
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

  const dialogUi = DIALOG_UI[details.type]

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      backdrop="blur"
      placement="center"
      classNames={createSecondaryModalClassNames({
        base: `${CARD_STYLES.GLASS_CARD} ${dialogUi.borderClass}`
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
            <ModalHeader className={`flex gap-2 items-center ${dialogUi.titleClass}`}>
              {dialogUi.icon}
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
                {isCopied ? t('common.copied') : t('common.copy')}
              </Button>
              <Button
                color={dialogUi.buttonColor}
                variant="light"
                onPress={handleClose}
                className="font-medium"
              >
                {t('common.close')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default GlobalDialogContent
