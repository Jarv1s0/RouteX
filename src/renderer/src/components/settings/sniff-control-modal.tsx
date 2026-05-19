import React from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'

import {
  SnifferSettingsFormFields,
  useSnifferSettingsEditor
} from '@renderer/components/sniffer/sniffer-settings-editor'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const SniffControlModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { t } = useI18n()
  const { appConfig } = useAppConfig()
  const { collapseSidebar = false, siderWidth = 250 } = appConfig || {}
  const sniffEditor = useSnifferSettingsEditor()

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="4xl"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={createSecondaryModalClassNames()}
    >
      <ModalContent
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1100 })}
      >
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 px-4 py-2">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-xl font-bold text-transparent">
                {t('settings.sniffControl.title')}
              </span>
              <span className="text-small font-normal text-default-400">
                {t('settings.sniffControl.description')}
              </span>
            </ModalHeader>

            <ModalBody className="px-4 py-2">
              <div className="flex flex-col gap-2">
                <SnifferSettingsFormFields editor={sniffEditor} />
              </div>
            </ModalBody>

            <ModalFooter className="px-4 py-2">
              <Button variant="light" className="px-6 font-medium" onPress={onClose}>
                {t('common.close')}
              </Button>
              <Button
                color="primary"
                variant="shadow"
                className="px-8 font-medium"
                isDisabled={false}
                onPress={async () => {
                  if (sniffEditor.changed) {
                    await sniffEditor.save()
                  }
                  onClose()
                }}
              >
                {sniffEditor.changed ? t('common.save') : t('common.done')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default SniffControlModal
