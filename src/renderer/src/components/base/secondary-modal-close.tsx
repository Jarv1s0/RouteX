import { Button } from '@heroui/react'
import { useI18n } from '@renderer/i18n'
import { SECONDARY_MODAL_ICON_CLOSE_BUTTON_CLASSNAME } from '@renderer/utils/modal-styles'
import React from 'react'
import { IoClose } from 'react-icons/io5'

interface Props {
  onPress: () => void
  className?: string
}

const SecondaryModalCloseButton: React.FC<Props> = ({ onPress, className }) => {
  const { t } = useI18n()

  return (
    <Button
      isIconOnly
      size="sm"
      variant="light"
      aria-label={t('common.close')}
      className={[SECONDARY_MODAL_ICON_CLOSE_BUTTON_CLASSNAME, className].filter(Boolean).join(' ')}
      onPress={onPress}
    >
      <IoClose className="text-lg" />
    </Button>
  )
}

export default SecondaryModalCloseButton
