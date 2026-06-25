import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tooltip
} from '@heroui/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import { MdDeleteForever } from 'react-icons/md'
import { FaPlus } from 'react-icons/fa6'
import { useMainPaneModalContentStyle } from '@renderer/hooks/use-main-pane-modal-style'
import { IoIosHelpCircle } from 'react-icons/io'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
import { CARD_STYLES } from '@renderer/utils/card-styles'

const overrideDropdownClassNames = {
  ...CARD_STYLES.GLASS_DROPDOWN,
  content: `${CARD_STYLES.GLASS_DROPDOWN.content} min-w-[160px] w-[160px]`
}

const overrideDropdownItemClasses = { base: 'rounded-xl' }
const inputClassName = 'w-[80%] sm:w-[85%]'
const overrideRowClassName =
  'flex items-center justify-between px-3 py-2 bg-default-100/50 border border-default-200/50 rounded-xl'

interface Props {
  item: ProfileItem
  updateProfileItem: (item: ProfileItem) => Promise<boolean | void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { t } = useI18n()
  const { item, updateProfileItem, onClose } = props
  const modalContentStyle = useMainPaneModalContentStyle(1024)
  const { overrideConfig } = useOverrideConfig()
  const { items: overrideItems = [] } = overrideConfig || {}
  const [values, setValues] = useState({ ...item, autoUpdate: item.autoUpdate ?? true })
  const [saving, setSaving] = useState(false)

  const getOverrideItem = (id: string): OverrideItem | undefined =>
    overrideItems.find((overrideItem) => overrideItem.id === id)

  const onSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const itemToSave = {
        ...values,
        interval: values.autoUpdate ? values.interval || 1440 : values.interval,
        override: values.override?.filter((id) => {
          const overrideItem = getOverrideItem(id)
          return overrideItem && !overrideItem.global
        })
      }

      const success = await updateProfileItem(itemToSave)
      if (success === false) {
        setSaving(false)
        return
      }
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
      size="2xl"
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
        <ModalHeader className="flex app-drag">
          {item.id ? t('profiles.editInfo') : t('page.profiles.importRemote')}
        </ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-y-auto px-6 pt-2 pb-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <SettingItem title={t('confirm.name')}>
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
                  <SettingItem title={t('profiles.url')}>
                    <Input
                      size="sm"
                      isClearable
                      className={inputClassName}
                      value={values.url}
                      onValueChange={(v) => {
                        setValues({ ...values, url: v })
                      }}
                    />
                  </SettingItem>
                  <SettingItem title={t('profiles.customUa')}>
                    <Input
                      size="sm"
                      className={inputClassName}
                      value={values.ua ?? ''}
                      onValueChange={(v) => {
                        setValues({ ...values, ua: v.trim() || undefined })
                      }}
                    />
                  </SettingItem>
                </>
              )}
            </div>

            {values.type === 'remote' && (
              <div className="flex flex-col px-4 py-2 bg-default-100/50 rounded-2xl border border-default-200/50">
                <SettingItem title={t('profiles.verifyFormat')} divider>
                  <AppSwitch
                    size="sm"
                    isSelected={values.verify ?? false}
                    onValueChange={(v) => {
                      setValues({ ...values, verify: v })
                    }}
                  />
                </SettingItem>
                <SettingItem title={t('profiles.useProxyUpdate')} divider>
                  <AppSwitch
                    size="sm"
                    isSelected={values.useProxy ?? false}
                    onValueChange={(v) => {
                      setValues({ ...values, useProxy: v })
                    }}
                  />
                </SettingItem>
                <SettingItem title={t('profiles.autoUpdate')}>
                  <div className="flex items-center gap-4">
                    {values.autoUpdate && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-default-500 whitespace-nowrap">
                          {t('profiles.updateIntervalMinutes')}
                        </span>
                        <Input
                          size="sm"
                          type="text"
                          className="w-[100px]"
                          placeholder="默认 1440"
                          value={values.interval === undefined ? '' : values.interval.toString()}
                          onValueChange={(v) => {
                            if (!/^\d*$/.test(v)) return
                            const parsed = parseInt(v)
                            setValues({ ...values, interval: isNaN(parsed) ? undefined : parsed })
                          }}
                          disabled={values.locked}
                        />
                        {values.locked && (
                          <Tooltip content={t('profiles.remoteManagedInterval')}>
                            <Button isIconOnly size="sm" variant="light">
                              <IoIosHelpCircle className="text-lg" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    )}
                    <AppSwitch
                      size="sm"
                      isSelected={values.autoUpdate ?? false}
                      onValueChange={(v) => {
                        setValues({
                          ...values,
                          autoUpdate: v,
                          interval: v && !values.interval ? 1440 : values.interval
                        })
                      }}
                    />
                  </div>
                </SettingItem>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">{t('profiles.overrides')}</span>
              <div className="flex flex-col gap-2">
                {overrideItems
                  .filter((i) => i.global)
                  .map((i) => (
                    <div className={overrideRowClassName} key={i.id}>
                      <div className="flex items-center gap-2 overflow-hidden" title={i.name}>
                        <span className="text-sm truncate">{i.name}</span>
                        <span className="text-[10px] font-medium bg-default-200/50 text-default-600 px-1.5 py-0.5 rounded-md cursor-default shrink-0">
                          {t('profiles.globalSuffix')}
                        </span>
                      </div>
                    </div>
                  ))}
                {values.override?.map((i) => {
                  const overrideItem = getOverrideItem(i)
                  if (!overrideItem || overrideItem.global) return null
                  return (
                    <div className={overrideRowClassName} key={i}>
                      <span className="text-sm truncate" title={overrideItem.name}>
                        {overrideItem.name}
                      </span>
                      <Button
                        isIconOnly
                        color="danger"
                        variant="light"
                        size="sm"
                        className="min-w-0 w-7 h-7 ml-2"
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
                <Dropdown classNames={overrideDropdownClassNames}>
                  <DropdownTrigger>
                    <Button
                      fullWidth
                      size="sm"
                      variant="bordered"
                      color="primary"
                      className="border-dashed border-2 border-primary/30 text-primary hover:border-primary/60 hover:bg-primary/5 rounded-xl"
                    >
                      <FaPlus />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    itemClasses={overrideDropdownItemClasses}
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
                        <DropdownItem key={i.id} className="truncate">
                          <span className="block truncate" title={i.name}>
                            {i.name}
                          </span>
                        </DropdownItem>
                      ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          </div>
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
