import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import React from 'react'

import { SnifferSettingsFormFields, useSnifferSettingsEditor } from '@renderer/components/sniffer/sniffer-settings-editor'
import { useI18n } from '@renderer/i18n'

const Sniffer: React.FC = () => {
  const { t } = useI18n()
  const editor = useSnifferSettingsEditor()

  return (
    <BasePage
      title={t('page.sniffer.title')}
      header={
        editor.changed && (
          <Button
            size="sm"
            className="app-nodrag"
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
