import { Button, ModalFooter } from '@heroui/react'
import React from 'react'

interface SecondaryModalFooterProps {
  cancelText?: string
  onCancel?: () => void
  cancelDisabled?: boolean
  confirmText: string
  onConfirm: () => void
  confirmDisabled?: boolean
  confirmLoading?: boolean
  confirmColor?: 'primary' | 'danger' | 'warning' | 'success' | 'default' | 'secondary'
  className?: string
}

const SecondaryModalFooter: React.FC<SecondaryModalFooterProps> = ({
  cancelText,
  onCancel,
  cancelDisabled = false,
  confirmText,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  confirmColor = 'primary',
  className
}) => {
  return (
    <ModalFooter className={['px-6 pt-2 pb-3 gap-2', className].filter(Boolean).join(' ')}>
      {cancelText && onCancel && (
        <Button
          size="sm"
          variant="flat"
          radius="lg"
          onPress={onCancel}
          isDisabled={cancelDisabled}
          className="h-8 px-4 font-medium text-foreground/80"
        >
          {cancelText}
        </Button>
      )}
      <Button
        size="sm"
        color={confirmColor}
        variant="solid"
        radius="lg"
        onPress={onConfirm}
        isDisabled={confirmDisabled}
        isLoading={confirmLoading}
        className="h-8 px-5 font-medium shadow-sm"
      >
        {confirmText}
      </Button>
    </ModalFooter>
  )
}

export default SecondaryModalFooter
