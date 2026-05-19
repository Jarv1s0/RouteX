import { Button } from '@heroui/react'
import BasePage, { FLOATING_ACTION_BUTTON_CLASS } from '@renderer/components/base/base-page'
import React from 'react'

import {
  SnifferSettingsFormFields,
  useSnifferSettingsEditor
} from '@renderer/components/sniffer/sniffer-settings-editor'
import { useI18n } from '@renderer/i18n'

const Sniffer: React.FC = () => {
  const { t } = useI18n()
  const editor = useSnifferSettingsEditor()

  return (
    <BasePage
      title={t('page.sniffer.title')}
      footer={
        editor.changed && (
          <Button
            size="sm"
            className={FLOATING_ACTION_BUTTON_CLASS}
            color="primary"
            onPress={() => void editor.save()}
          >
            {t('common.save')}
          </Button>
        )
      }
    >
      <div className="p-2">
        <SnifferSettingsFormFields editor={editor} />
      </div>
    </BasePage>
  )
}

export default Sniffer
