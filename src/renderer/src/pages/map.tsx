import React from 'react'
import TopologyMap from '@renderer/components/TopologyMap'
import BasePage from '@renderer/components/base/base-page'
import { Card, CardBody } from '@heroui/react'
import { CARD_STYLES } from '@renderer/utils/card-styles'

const MapPage: React.FC = () => {
  return (
    <BasePage title="网络拓扑">
      <div className="flex flex-col h-full w-full p-2">
        <Card className={`${CARD_STYLES.BASE} ${CARD_STYLES.INACTIVE} hover:!scale-100 !cursor-default flex-1 w-full`}>
          <CardBody className="p-0 overflow-hidden relative w-full h-full">
            <TopologyMap />
          </CardBody>
        </Card>
      </div>
    </BasePage>
  )
}

export default MapPage
