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
      title={t('page.connections.title')}
      headerExtra={
        <Button
          isIconOnly
          variant="light"
          onPress={() => setIsSettingModalOpen(true)}
          className="text-default-500 min-w-8 w-8 h-8 min-h-8"
        >
          <MdTune size={18} />
        </Button>
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
