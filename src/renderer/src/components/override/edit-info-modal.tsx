import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem
} from '@heroui/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  item: OverrideItem
  updateOverrideItem: (item: OverrideItem) => Promise<boolean | void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { item, updateOverrideItem, onClose } = props
  const { t } = useI18n()
  const modalContentStyle = useMainPaneModalContentStyle(720)
  const [values, setValues] = useState(item)
  const [saving, setSaving] = useState(false)
  const inputClassName = 'w-full sm:max-w-[420px]'

  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const itemToSave = {
        ...values
      }

      const success = await updateOverrideItem(itemToSave)
      if (success === false) {
        setSaving(false)
        return
      }
      onClose()
    } catch (e) {
      notifyError(e, {
        title: item.id ? t('override.saveInfoFailed') : t('profiles.importOverrideFailed')
      })
      setSaving(false)
    }
  }

  return (
    <Modal
      backdrop="blur"
      size="md"
      style={{ zIndex: 99999 }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={modalContentStyle}
      >
        <ModalHeader className="flex px-6 pb-2 pt-5 app-drag">
          {item.id ? t('override.editTitle') : t('override.importRemote')}
        </ModalHeader>
        <ModalBody className="gap-4 px-6 py-3 overflow-y-auto">
          <SettingItem title={t('override.name')}>
            <Input
              size="sm"
              className={inputClassName}
              value={values.name}
              onValueChange={(v) => {
                setValues({ ...values, name: v })
              }}
            />
          </SettingItem>
          {values.type === 'remote' && (
            <>
              <SettingItem title={t('override.url')}>
                <Input
                  size="sm"
                  className={inputClassName}
                  value={values.url || ''}
                  onValueChange={(v) => {
                    setValues({ ...values, url: v })
                  }}
                />
              </SettingItem>
            </>
          )}
          <SettingItem title={t('override.fileType')}>
            <Select
              size="sm"
              className={inputClassName}
              selectedKeys={[values.ext]}
              onSelectionChange={(keys) => {
                const key = Array.from(keys)[0] as 'js' | 'yaml'
                setValues({ ...values, ext: key })
              }}
            >
              <SelectItem key="yaml">YAML</SelectItem>
              <SelectItem key="js">JavaScript</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title={t('override.global')}>
            <AppSwitch
              size="sm"
              isSelected={values.global ?? false}
              onValueChange={(v) => {
                setValues({ ...values, global: v })
              }}
            />
          </SettingItem>
        </ModalBody>
        <ModalFooter className="px-6 pb-5 pt-2">
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" color="primary" isLoading={saving} onPress={onSave}>
            {item.id ? t('common.save') : t('common.import')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditInfoModal
