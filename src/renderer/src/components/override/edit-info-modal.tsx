import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Input,
  Select,
  SelectItem
} from '@heroui/react'
import SecondaryModalFooter from '@renderer/components/base/secondary-modal-footer'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'
import { CARD_STYLES } from '@renderer/utils/card-styles'
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
  const inputClassName = 'w-[80%] sm:w-[85%]'

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
              classNames={CARD_STYLES.GLASS_SELECT}
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
        <SecondaryModalFooter
          cancelText={t('common.cancel')}
          onCancel={onClose}
          confirmText={item.id ? t('common.save') : t('common.import')}
          onConfirm={onSave}
          confirmLoading={saving}
        />
      </ModalContent>
    </Modal>
  )
}

export default EditInfoModal
