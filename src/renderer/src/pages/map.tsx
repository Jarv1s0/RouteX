import React from 'react'
import TopologyMap from '@renderer/components/TopologyMap'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'
import { useI18n } from '@renderer/i18n'

const MapPage: React.FC = () => {
  const { t } = useI18n()

  return (
    <BasePage title={t('page.map.title')}>
      <div className="flex flex-col h-full w-full p-2">
        <Card
          className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default flex-1 w-full`}
        >
          <CardBody className="p-0 overflow-hidden relative w-full h-full">
            <TopologyMap />
          </CardBody>
        </Card>
      </div>
    </BasePage>
  )
}

export default MapPage
