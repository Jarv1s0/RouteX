import React from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from '@heroui/react'

import { SnifferSettingsFormFields, useSnifferSettingsEditor } from '@renderer/components/sniffer/sniffer-settings-editor'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { patchControledMihomoConfig, restartCore } from '@renderer/utils/mihomo-ipc'
import { createSecondaryModalClassNames } from '@renderer/utils/modal-styles'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const CARD_CLASS =
  'group flex items-center justify-between gap-4 rounded-xl border border-default-100 bg-content1/50 p-3 shadow-sm transition-all duration-300 hover:border-default-200 hover:bg-content1 hover:shadow-md'

const SniffControlModal: React.FC<Props> = ({ isOpen, onOpenChange }) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controlSniff = true } = appConfig || {}
  const sniffEditor = useSnifferSettingsEditor()

  const handleToggleControlSniff = async (value: boolean): Promise<void> => {
    try {
      await patchAppConfig({ controlSniff: value })
      await patchControledMihomoConfig({})
      await restartCore()
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
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 px-4 py-2">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-xl font-bold text-transparent">
                接管域名嗅探设置
              </span>
              <span className="text-small font-normal text-default-400">
                在这里直接管理域名嗅探接管开关和完整的嗅探配置
              </span>
            </ModalHeader>

            <ModalBody className="px-4 py-2">
              <div className="flex flex-col gap-2">
                <div className={CARD_CLASS}>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="whitespace-nowrap font-medium text-foreground-600 transition-colors group-hover:text-foreground-900">
                      接管域名嗅探配置
                    </span>
                    <span className="whitespace-nowrap text-xs text-default-400 transition-colors group-hover:text-default-500">
                      开启后应用会接管配置文件中的 sniffer 配置段
                    </span>
                  </div>
                  <Switch
                    size="sm"
                    color="primary"
                    isSelected={controlSniff}
                    onValueChange={handleToggleControlSniff}
                  />
                </div>

                <SnifferSettingsFormFields editor={sniffEditor} />
              </div>
            </ModalBody>

            <ModalFooter className="px-4 py-2">
              <Button variant="light" className="px-6 font-medium" onPress={onClose}>
                关闭
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
                {sniffEditor.changed ? '保存' : '完成'}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

export default SniffControlModal
