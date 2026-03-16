import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { BaseEditor } from '@renderer/components/base/base-editor-lazy'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React, { useState } from 'react'
import SecondaryModalCloseButton from '@renderer/components/base/secondary-modal-close'
import {
  createSecondaryModalClassNames,
  SECONDARY_MODAL_HEADER_CLASSNAME
} from '@renderer/utils/modal-styles'
interface Props {
  script: string
  onCancel: () => void
  onConfirm: (script: string) => void
}
const PacEditorModal: React.FC<Props> = (props) => {
  const { script, onCancel, onConfirm } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState(script)

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={createSecondaryModalClassNames({
        base: 'max-w-none w-full'
      })}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onCancel}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className={SECONDARY_MODAL_HEADER_CLASSNAME}>
          <span>编辑 PAC 脚本</span>
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
            取消
          </Button>
          <Button size="sm" color="primary" onPress={() => onConfirm(currData)}>
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PacEditorModal
