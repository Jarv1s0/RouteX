import { cn, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Tooltip } from '@heroui/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import { MdDeleteForever } from 'react-icons/md'
import { FaPlus } from 'react-icons/fa6'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { IoIosHelpCircle } from 'react-icons/io'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  item: ProfileItem
  updateProfileItem: (item: ProfileItem) => Promise<void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { item, updateProfileItem, onClose } = props
  const { appConfig: { collapseSidebar = false, siderWidth = 250 } = {} } = useAppConfig()
  const { overrideConfig } = useOverrideConfig()
  const { items: overrideItems = [] } = overrideConfig || {}
  const [values, setValues] = useState({ ...item, autoUpdate: item.autoUpdate ?? true })
  const [saving, setSaving] = useState(false)
  const inputWidth = 'w-[400px] md:w-[400px] lg:w-[600px] xl:w-[800px]'

  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const itemToSave = {
        ...values,
        override: values.override?.filter(
          (i) =>
            overrideItems.find((t) => t.id === i) && !overrideItems.find((t) => t.id === i)?.global
        )
      }

      await updateProfileItem(itemToSave)
      onClose()
    } catch (e) {
      notifyError(e, {
        title: item.id ? t('profiles.saveInfoFailed') : t('profiles.importRemoteProfileFailed')
      })
      setSaving(false)
    }
  }

  return (
    <Modal
      backdrop="blur"
      size="5xl"
      classNames={{
        backdrop: 'top-[48px]',
        base: 'w-[600px] md:w-[600px] lg:w-[800px] xl:w-[1024px]'
      }}
      style={{ zIndex: 99999 }}
      hideCloseButton
      isOpen={true}
      placement="top"
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1024 })}
      >
        <ModalHeader className="flex app-drag">
          {item.id ? t('profiles.editInfo') : t('page.profiles.importRemote')}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-y-auto">
          <SettingItem title={t('confirm.name')}>
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
              <SettingItem title={t('profiles.url')}>
                <Input
                  size="sm"
                  className={cn(inputWidth)}
                  value={values.url}
                  onValueChange={(v) => {
                    setValues({ ...values, url: v })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('profiles.fingerprint')}>
                <Input
                  size="sm"
                  className={cn(inputWidth)}
                  value={values.fingerprint ?? ''}
                  onValueChange={(v) => {
                    setValues({ ...values, fingerprint: v.trim() || undefined })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('profiles.customUa')}>
                <Input
                  size="sm"
                  className={cn(inputWidth)}
                  value={values.ua ?? ''}
                  onValueChange={(v) => {
                    setValues({ ...values, ua: v.trim() || undefined })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('profiles.verifyFormat')}>
                <AppSwitch
                  size="sm"
                  isSelected={values.verify ?? false}
                  onValueChange={(v) => {
                    setValues({ ...values, verify: v })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('profiles.useProxyUpdate')}>
                <AppSwitch
                  size="sm"
                  isSelected={values.useProxy ?? false}
                  onValueChange={(v) => {
                    setValues({ ...values, useProxy: v })
                  }}
                />
              </SettingItem>
              <SettingItem title={t('profiles.autoUpdate')}>
                <AppSwitch
                  size="sm"
                  isSelected={values.autoUpdate ?? false}
                  onValueChange={(v) => {
                    setValues({ ...values, autoUpdate: v })
                  }}
                />
              </SettingItem>
              {values.autoUpdate && (
                <SettingItem
                  title={t('profiles.updateIntervalMinutes')}
                  actions={
                    values.locked && (
                      <Tooltip content={t('profiles.remoteManagedInterval')}>
                        <Button isIconOnly size="sm" variant="light">
                          <IoIosHelpCircle className="text-lg" />
                        </Button>
                      </Tooltip>
                    )
                  }
                >
                  <Input
                    size="sm"
                    type="number"
                    className={cn(inputWidth)}
                    value={values.interval?.toString() ?? ''}
                    onValueChange={(v) => {
                      setValues({ ...values, interval: parseInt(v) })
                    }}
                    disabled={values.locked}
                  />
                </SettingItem>
              )}
              <SettingItem title={t('profiles.resetDay')}>
                <Input
                  size="sm"
                  className={cn(inputWidth)}
                  inputMode="numeric"
                  placeholder={t('profiles.resetDayPlaceholder')}
                  value={values.resetDay?.toString() ?? ''}
                  onValueChange={(v) => {
                    if (!v || v === '') {
                      setValues({ ...values, resetDay: undefined })
                    } else {
                      const num = parseInt(v)
                      if (!isNaN(num) && num >= 1 && num <= 31) {
                        setValues({ ...values, resetDay: num })
                      }
                    }
                  }}
                />
              </SettingItem>
            </>
          )}
          <SettingItem title={t('profiles.overrides')}>
            <div>
              {overrideItems
                .filter((i) => i.global)
                .map((i) => {
                  return (
                    <div className="flex mb-2" key={i.id}>
                      <Button disabled fullWidth variant="flat" size="sm">
                        {i.name} ({t('profiles.globalSuffix')})
                      </Button>
                    </div>
                  )
                })}
              {values.override?.map((i) => {
                if (!overrideItems.find((t) => t.id === i)) return null
                if (overrideItems.find((t) => t.id === i)?.global) return null
                return (
                  <div className="flex mb-2" key={i}>
                    <Button disabled fullWidth variant="flat" size="sm">
                      {overrideItems.find((t) => t.id === i)?.name}
                    </Button>
                    <Button
                      color="warning"
                      variant="flat"
                      className="ml-2"
                      size="sm"
                      onPress={() => {
                        setValues({
                          ...values,
                          override: values.override?.filter((t) => t !== i)
                        })
                      }}
                    >
                      <MdDeleteForever className="text-lg" />
                    </Button>
                  </div>
                )
              })}
              <Dropdown>
                <DropdownTrigger>
                  <Button fullWidth size="sm" variant="flat" color="default">
                    <FaPlus />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  emptyContent={t('profiles.noOverrides')}
                  onAction={(key) => {
                    setValues({
                      ...values,
                      override: Array.from(values.override || []).concat(key.toString())
                    })
                  }}
                >
                  {overrideItems
                    .filter((i) => !values.override?.includes(i.id) && !i.global)
                    .map((i) => (
                      <DropdownItem key={i.id}>{i.name}</DropdownItem>
                    ))}
                </DropdownMenu>
              </Dropdown>
            </div>
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
