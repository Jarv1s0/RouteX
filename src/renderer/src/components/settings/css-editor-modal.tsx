import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { BaseEditor } from '@renderer/components/base/base-editor-lazy'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getMainPaneModalContentStyle, MAIN_PANE_MODAL_CLASSNAMES } from '@renderer/utils/modal-styles'
import { readTheme } from '@renderer/utils/theme-ipc'
import { useI18n } from '@renderer/i18n'
import React, { useEffect, useState } from 'react'
interface Props {
  theme: string
  onCancel: () => void
  onConfirm: (script: string) => void
}
const CSSEditorModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { theme, onCancel, onConfirm } = props
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')

  useEffect(() => {
    if (theme) {
      readTheme(theme).then((css) => {
        setCurrData(css)
      })
    }
  }, [theme])

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
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1400 })}
      >
        <ModalHeader className="flex pb-0 app-drag">
          {t('settings.appearance.editTheme')}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-hidden">
          <BaseEditor
            language="css"
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

export default CSSEditorModal
