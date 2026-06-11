import React from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useI18n } from '@renderer/i18n'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'

export interface ConfirmButton {
  key: string
  text: string
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost'
  onPress: () => void | Promise<void>
}

interface Props {
  onChange: (open: boolean) => void
  title?: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  buttons?: ConfirmButton[]
  className?: string
}

const ConfirmModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const {
    onChange,
    title = t('confirm.title'),
    description,
    confirmText = t('common.confirm'),
    cancelText = t('common.cancel'),
    onConfirm,
    buttons,
    className
  } = props
  const {
    appConfig: { collapseSidebar = false, siderWidth = 250 } = {}
  } = useAppConfig()

  const renderButtons = () => {
    if (buttons && buttons.length > 0) {
      return buttons.map((button) => (
        <Button
          key={button.key}
          size="sm"
          color={button.color || 'primary'}
          variant={button.variant || 'solid'}
          onPress={async () => {
            await button.onPress()
            onChange(false)
          }}
        >
          {button.text}
        </Button>
      ))
    }

    return (
      <>
        <Button size="sm" variant="light" onPress={() => onChange(false)}>
          {cancelText}
        </Button>
        <Button
          size="sm"
          color="danger"
          onPress={async () => {
            if (onConfirm) {
              await onConfirm()
            }
            onChange(false)
          }}
        >
          {confirmText}
        </Button>
      </>
    )
  }

  return (
    <Modal
      backdrop="blur"
      hideCloseButton
      isOpen={true}
      size="5xl"
      onOpenChange={onChange}
      scrollBehavior="inside"
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
    >
      <ModalContent
        className={className}
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 400 })}
      >
        {() => (
          <div className="animate-pop-in">
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>
              <div className="leading-relaxed">{description}</div>
            </ModalBody>
            <ModalFooter className="space-x-2">{renderButtons()}</ModalFooter>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}
export default ConfirmModal
