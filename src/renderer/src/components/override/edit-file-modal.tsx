import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getOverride, setOverride } from '@renderer/utils/override-ipc'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { MAIN_PANE_MODAL_CLASSNAMES } from '@renderer/utils/modal-styles'
import ConfirmModal from '../base/base-confirm'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  id: string
  language: 'javascript' | 'yaml'
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { id, language, onClose } = props
  const modalContentStyle = useMainPaneModalContentStyle(1400)
  const [currData, setCurrData] = useState('')
  const [originalData, setOriginalData] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const isModified = currData !== originalData

  const handleClose = (): void => {
    if (isModified) {
      setIsConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const getContent = async (): Promise<void> => {
    const data = await getOverride(id, language === 'javascript' ? 'js' : 'yaml')
    setCurrData(data)
    setOriginalData(data)
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal
      backdrop="blur"
      classNames={MAIN_PANE_MODAL_CLASSNAMES}
      style={{ zIndex: 99999 }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={handleClose}
      scrollBehavior="inside"
    >
      {isConfirmOpen && (
        <ConfirmModal
          title={t('override.cancelTitle')}
          description={t('override.unsavedDescription')}
          confirmText={t('override.discardChanges')}
          cancelText={t('override.continueEditing')}
          onChange={setIsConfirmOpen}
          onConfirm={onClose}
        />
      )}
      <ModalContent
        className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={modalContentStyle}
      >
        <ModalHeader className="flex pb-0 app-drag">
          {language === 'javascript'
            ? t('override.editScriptTitle')
            : t('override.editConfigTitle')}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-hidden">
          <BaseEditor
            language={language}
            value={currData}
            originalValue={isDiff ? originalData : undefined}
            onChange={(value) => setCurrData(value)}
            diffRenderSideBySide={sideBySide}
          />
        </ModalBody>
        <ModalFooter className="pt-0 flex justify-between">
          <div className="flex items-center space-x-2">
            <AppSwitch size="sm" isSelected={isDiff} onValueChange={setIsDiff}>
              {t('override.showChanges')}
            </AppSwitch>
            <AppSwitch size="sm" isSelected={sideBySide} onValueChange={setSideBySide}>
              {t('override.sideBySide')}
            </AppSwitch>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="light" onPress={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              color="primary"
              isLoading={saving}
              isDisabled={!isModified || saving}
              onPress={async () => {
                setSaving(true)
                try {
                  await setOverride(id, language === 'javascript' ? 'js' : 'yaml', currData)
                  onClose()
                } catch (e) {
                  notifyError(e, { title: t('override.saveFailedTitle') })
                  setSaving(false)
                }
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
