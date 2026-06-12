import { useEffect, useState } from 'react'
import yaml from 'js-yaml'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { BaseEditor } from '../base/base-editor-lazy'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { MAIN_PANE_MODAL_CLASSNAMES } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  bypass: string[]
  onCancel: () => void
  onConfirm: (bypass: string[]) => void
}

interface ParsedYaml {
  bypass?: string[]
}

const ByPassEditorModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { bypass, onCancel, onConfirm } = props
  const modalContentStyle = useMainPaneModalContentStyle(1400)
  const [currData, setCurrData] = useState<string>('')
  useEffect(() => {
    setCurrData(yaml.dump({ bypass }))
  }, [bypass])
  const handleConfirm = (): void => {
    try {
      const parsed = yaml.load(currData) as ParsedYaml
      if (parsed && Array.isArray(parsed.bypass)) {
        onConfirm(parsed.bypass)
      } else {
        alert(t('sysproxy.yamlFormatError'))
      }
    } catch (e) {
      alert(t('sysproxy.yamlParseFailed', { error: String(e) }))
    }
  }

  return (
    <Modal
      backdrop="blur"
      classNames={MAIN_PANE_MODAL_CLASSNAMES}
      style={{ zIndex: 99999 }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onCancel}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={modalContentStyle}
      >
        <ModalHeader className="flex pb-0 app-drag">{t('sysproxy.editBypassYaml')}</ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-hidden">
          <BaseEditor
            language="yaml"
            value={currData}
            onChange={(value) => setCurrData(value || '')}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" color="primary" onPress={handleConfirm}>
            {t('common.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ByPassEditorModal
