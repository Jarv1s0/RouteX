import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Tabs, Tab } from '@heroui/react'
import React, { useEffect, useState, useCallback } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getRuntimeConfigStr } from '@renderer/utils/mihomo-ipc'
import { getOverrideProfileStr } from '@renderer/utils/override-ipc'
import { getProfileConfig, getRawProfileStr } from '@renderer/utils/profile-ipc'
import useSWR from 'swr'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getMainPaneModalContentStyle } from '@renderer/utils/modal-styles'
import { useI18n } from '@renderer/i18n'

import AppSwitch from '@renderer/components/base/app-switch'
interface Props {
  onClose: () => void
}

type DiffSource = 'raw' | 'override'

const ConfigViewer: React.FC<Props> = ({ onClose }) => {
  const { t } = useI18n()
  const {
    appConfig: { disableAnimation = false, collapseSidebar = false, siderWidth = 250 } = {}
  } = useAppConfig()
  const [runtimeConfig, setRuntimeConfig] = useState('')
  const [rawProfile, setRawProfile] = useState('')
  const [overrideConfig, setOverrideConfig] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [diffSource, setDiffSource] = useState<DiffSource>('raw')
  const [sideBySide, setSideBySide] = useState(false)

  const { data: config } = useSWR('getProfileConfig', getProfileConfig)

  const fetchConfigs = useCallback(async () => {
    setRuntimeConfig(await getRuntimeConfigStr())
    setRawProfile(await getRawProfileStr())
    setOverrideConfig(await getOverrideProfileStr())
  }, [config])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  const diffSourceConfig = {
    raw: {
      label: t('configViewer.rawProfile'),
      value: rawProfile
    },
    override: {
      label: t('configViewer.overrideText'),
      value: overrideConfig
    }
  } satisfies Record<DiffSource, { label: string; value: string }>
  const selectedDiffSource = diffSourceConfig[diffSource]
  const originalValue = isDiff ? selectedDiffSource.value : undefined

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
      style={{ zIndex: 99999 }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent
        className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden"
        style={getMainPaneModalContentStyle({ collapseSidebar, siderWidth, maxWidthPx: 1400 })}
      >
        <ModalHeader className="flex pb-0 app-drag">{t('configViewer.title')}</ModalHeader>
        <ModalBody className="flex-1 min-h-0 overflow-hidden">
          <BaseEditor
            language="yaml"
            value={runtimeConfig}
            originalValue={originalValue}
            readOnly
            diffRenderSideBySide={sideBySide}
            diffOriginalLabel={t('configViewer.diffOriginal', { source: selectedDiffSource.label })}
            diffModifiedLabel={t('configViewer.diffModified')}
          />
        </ModalBody>
        <ModalFooter className="pt-0 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <AppSwitch size="sm" isSelected={isDiff} onValueChange={setIsDiff}>
              {t('configViewer.diffToggle')}
            </AppSwitch>
            <AppSwitch
              size="sm"
              isSelected={sideBySide}
              isDisabled={!isDiff}
              onValueChange={setSideBySide}
            >
              {t('configViewer.sideBySide')}
            </AppSwitch>
            <div className="flex items-center gap-2">
              <span className="text-sm text-default-500">{t('configViewer.diffSource')}</span>
              <Tabs
                size="sm"
                variant="bordered"
                selectedKey={diffSource}
                isDisabled={!isDiff}
                onSelectionChange={(key) => setDiffSource(key as DiffSource)}
              >
                <Tab key="raw" title={t('configViewer.rawProfile')} />
                <Tab key="override" title={t('configViewer.overrideText')} />
              </Tabs>
            </div>
          </div>
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfigViewer
