import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import React from 'react'

import { SnifferSettingsFormFields, useSnifferSettingsEditor } from '@renderer/components/sniffer/sniffer-settings-editor'

const Sniffer: React.FC = () => {
  const editor = useSnifferSettingsEditor()

  return (
    <BasePage
      title="域名嗅探设置"
      header={
        editor.changed && (
          <Button
            size="sm"
            className="app-nodrag"
            color="primary"
            onPress={() => void editor.save()}
          >
            保存
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
