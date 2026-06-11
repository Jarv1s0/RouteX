import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getProfileStr, setProfileStr } from '@renderer/utils/profile-ipc'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'
import ConfirmModal from '../base/base-confirm'
import { notifyError } from '@renderer/utils/notify'
import { restartCoreInBackground } from '@renderer/utils/core-restart'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  id: string
  isRemote: boolean
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { id, isRemote, onClose } = props
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const [originalData, setOriginalData] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const isModified = currData !== originalData

  const handleClose = (): void => {
    if (isModified) {
      setIsConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const getContent = async (): Promise<void> => {
    const data = await getProfileStr(id)
    setCurrData(data)
    setOriginalData(data)
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal
      backdrop="blur"
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
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
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1400 })}
      >
        <ModalHeader className="flex pb-0 app-drag">
          <div className="flex justify-start">
            <div className="flex items-center">{t('profiles.editProfile')}</div>
            {isRemote && (
              <small className="ml-2 text-foreground-500">
                {t('profiles.remoteEditWarningPrefix')}
                <Button
                  size="sm"
                  color="primary"
                  variant="light"
                  className="app-nodrag"
                  onPress={() => {
                    navigate('/override')
                  }}
                >
                  {t('profiles.overrides')}
                </Button>
                {t('profiles.remoteEditWarningSuffix')}
              </small>
            )}
          </div>
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-hidden">
          <BaseEditor
            language="yaml"
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
                  await setProfileStr(id, currData)
                  onClose()
                  restartCoreInBackground(t('profiles.applyProfileFailed'))
                } catch (e) {
                  notifyError(e, { title: t('profiles.saveProfileFailed') })
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
