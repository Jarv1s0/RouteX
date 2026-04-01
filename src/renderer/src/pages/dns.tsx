import React from 'react'
import { Button } from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import { DnsSettingsFormFields, useDnsSettingsEditor } from '@renderer/components/dns/dns-settings-editor'

const DNS: React.FC = () => {
  const editor = useDnsSettingsEditor()

  return (
    <BasePage
      title="DNS 设置"
      header={
        editor.changed && (
          <Button
            size="sm"
            className="app-nodrag"
            color="primary"
            isDisabled={editor.saveDisabled}
            onPress={() => void editor.save()}
          >
            保存
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
