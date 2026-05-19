import React from 'react'
import { Button } from '@heroui/react'

import BasePage, { FLOATING_ACTION_BUTTON_CLASS } from '@renderer/components/base/base-page'
import {
  DnsSettingsFormFields,
  useDnsSettingsEditor
} from '@renderer/components/dns/dns-settings-editor'
import { useI18n } from '@renderer/i18n'

const DNS: React.FC = () => {
  const { t } = useI18n()
  const editor = useDnsSettingsEditor()

  return (
    <BasePage
      title={t('page.dns.title')}
      footer={
        editor.changed && (
          <Button
            size="sm"
            className={FLOATING_ACTION_BUTTON_CLASS}
            color="primary"
            isDisabled={editor.saveDisabled}
            onPress={() => void editor.save()}
          >
            {t('common.save')}
          </Button>
        )
      }
    >
      <div className="p-2">
        <DnsSettingsFormFields editor={editor} />
      </div>
    </BasePage>
  )
}

export default DNS
