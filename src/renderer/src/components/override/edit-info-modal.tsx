import { cn, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem } from '@heroui/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'
import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  item: OverrideItem
  updateOverrideItem: (item: OverrideItem) => Promise<void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { item, updateOverrideItem, onClose } = props
  const { t } = useI18n()
  const modalContentStyle = useMainPaneModalContentStyle(1024)
  const [values, setValues] = useState(item)
  const [saving, setSaving] = useState(false)
  const inputWidth = 'w-[400px] md:w-[400px] lg:w-[600px] xl:w-[800px]'

  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const itemToSave = {
        ...values
      }

      await updateOverrideItem(itemToSave)
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
      size="5xl"
      classNames={{
        base: 'w-[600px] md:w-[600px] lg:w-[800px] xl:w-[1024px]'
      }}
      style={{ zIndex: 99999 }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={modalContentStyle}
      >
        <ModalHeader className="flex app-drag">
          {item.id ? t('override.editTitle') : t('override.importRemote')}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-y-auto">
          <SettingItem title={t('override.name')}>
            <Input
              size="sm"
              className={cn(inputWidth)}
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
                  className={cn(inputWidth)}
                  value={values.url || ''}
                  onValueChange={(v) => {
                    setValues({ ...values, url: v })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('override.fingerprint')}>
                <Input
                  size="sm"
                  className={cn(inputWidth)}
                  value={values.fingerprint ?? ''}
                  onValueChange={(v) => {
                    setValues({ ...values, fingerprint: v.trim() || undefined })
                  }}
                />
              </SettingItem>
            </>
          )}
          <SettingItem title={t('override.fileType')}>
            <Select
              size="sm"
              className={cn(inputWidth)}
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
        <ModalFooter>
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
