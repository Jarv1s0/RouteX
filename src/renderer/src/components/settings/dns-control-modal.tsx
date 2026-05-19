import React from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@heroui/react'

import {
  DnsSettingsFormFields,
  useDnsSettingsEditor
} from '@renderer/components/dns/dns-settings-editor'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { patchControledMihomoConfig } from '@renderer/utils/mihomo-ipc'
import {
  createSecondaryModalClassNames,
  getMainPaneModalContentStyle
} from '@renderer/utils/modal-styles'
import { toast } from 'sonner'
import { restartCoreInBackground } from '@renderer/utils/core-restart'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const CARD_CLASS =
  'group flex items-center justify-between gap-4 rounded-xl border border-default-100 bg-content1/50 p-3 shadow-sm transition-all duration-300 hover:border-default-200 hover:bg-content1 hover:shadow-md'

const DnsControlModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { t } = useI18n()
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    collapseSidebar = false,
    siderWidth = 250,
    controlDns = true,
    autoSetDNSMode = 'exec'
  } = appConfig || {}
  const dnsEditor = useDnsSettingsEditor()

  const handleToggleControlDns = async (value: boolean): Promise<void> => {
    try {
      await patchAppConfig({ controlDns: value })
      await patchControledMihomoConfig({})
      restartCoreInBackground(t('settings.dnsControl.applyFailed'))
    } catch (error) {
      toast.error(String(error))
    }
  }

  const handleChangeAutoSetDnsMode = async (value: 'none' | 'exec' | 'service'): Promise<void> => {
    try {
      await patchAppConfig({ autoSetDNSMode: value })
    } catch (error) {
      toast.error(String(error))
    }
  }

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
                {t('settings.dnsControl.title')}
              </span>
              <span className="text-small font-normal text-default-400">
                {t('settings.dnsControl.description')}
              </span>
            </ModalHeader>

            <ModalBody className="px-4 py-2">
              <div className="flex flex-col gap-2">
                <div className={CARD_CLASS}>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="whitespace-nowrap font-medium text-foreground-600 transition-colors group-hover:text-foreground-900">
                      {t('settings.dnsControl.control')}
                    </span>
                    <span className="whitespace-nowrap text-xs text-default-400 transition-colors group-hover:text-default-500">
                      {t('settings.dnsControl.controlDescription')}
                    </span>
                  </div>
                  <AppSwitch
                    size="sm"
                    color="primary"
                    isSelected={controlDns}
                    onValueChange={handleToggleControlDns}
                  />
                </div>

                {platform === 'darwin' && (
                  <div className={CARD_CLASS}>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="whitespace-nowrap font-medium text-foreground-600 transition-colors group-hover:text-foreground-900">
                        {t('settings.dnsControl.systemDnsMode')}
                      </span>
                      <span className="whitespace-nowrap text-xs text-default-400 transition-colors group-hover:text-default-500">
                        {t('settings.dnsControl.systemDnsModeDescription')}
                      </span>
                    </div>
                    <Select
                      size="sm"
                      disallowEmptySelection
                      selectedKeys={new Set([autoSetDNSMode])}
                      className="w-[150px]"
                      classNames={{
                        trigger:
                          'h-8 min-h-8 rounded-2xl border border-default-200 bg-default-100/50 shadow-sm transition-all data-[hover=true]:bg-default-200/50',
                        value: 'text-sm',
                        popoverContent:
                          'rounded-2xl border border-default-200/60 bg-background/90 shadow-xl backdrop-blur-md'
                      }}
                      onSelectionChange={(keys) => {
                        const nextValue = Array.from(keys)[0] as
                          | 'none'
                          | 'exec'
                          | 'service'
                          | undefined
                        if (nextValue) {
                          void handleChangeAutoSetDnsMode(nextValue)
                        }
                      }}
                    >
                      <SelectItem key="none">{t('settings.autoDns.none')}</SelectItem>
                      <SelectItem key="exec">{t('settings.autoDns.exec')}</SelectItem>
                      <SelectItem key="service">{t('settings.autoDns.service')}</SelectItem>
                    </Select>
                  </div>
                )}

                <DnsSettingsFormFields editor={dnsEditor} />
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
                isDisabled={dnsEditor.changed ? dnsEditor.saveDisabled : false}
                onPress={async () => {
                  if (dnsEditor.changed) {
                    await dnsEditor.save()
                  }
                  onClose()
                }}
              >
                {dnsEditor.changed ? t('common.save') : t('common.done')}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default DnsControlModal
