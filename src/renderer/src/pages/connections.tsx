import BasePage from '@renderer/components/base/base-page'
import ConnectionSettingModal from '@renderer/components/connections/connection-setting-modal'
import ConnectionsListContainer from '@renderer/components/connections/connections-list-container'
import { Button } from '@heroui/react'
import React, { useState } from 'react'
import { MdTune } from 'react-icons/md'
import { useI18n } from '@renderer/i18n'

const Connections: React.FC = () => {
  const { t } = useI18n()
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)

  return (
    <BasePage
      title={
        <div className="flex items-center gap-2">
          <span>{t('page.connections.title')}</span>
          <Button
            size="sm"
            isIconOnly
            variant="light"
            onPress={() => setIsSettingModalOpen(true)}
            className="h-6 w-6 min-w-0 app-nodrag text-default-500"
          >
            <MdTune className="text-base" />
          </Button>
        </div>
      }
    >
      {isSettingModalOpen && (
        <ConnectionSettingModal onClose={() => setIsSettingModalOpen(false)} />
      )}

      <ConnectionsListContainer />
    </BasePage>
  )
}

export default Connections
