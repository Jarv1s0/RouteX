import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { BaseEditor } from '@renderer/components/base/base-editor-lazy'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import React, { useState } from 'react'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'
interface Props {
  script: string
  onCancel: () => void
  onConfirm: (script: string) => void
}
const PacEditorModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { script, onCancel, onConfirm } = props
  const modalContentStyle = useMainPaneModalContentStyle(undefined, 100)
  const [currData, setCurrData] = useState(script)

  return (
    <Modal
      backdrop="blur"
      classNames={createSecondaryModalClassNames({
        base: 'max-w-none w-full'
      })}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onCancel}
      scrollBehavior="inside"
    >
      <ModalContent
        className="h-full"
        style={modalContentStyle}
      >
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>{t('sysproxy.editPac')}</span>
          <SecondaryModalCloseButton onPress={onCancel} />
        </ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language="javascript"
            value={currData}
            onChange={(value) => setCurrData(value || '')}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" color="primary" onPress={() => onConfirm(currData)}>
            {t('common.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PacEditorModal
