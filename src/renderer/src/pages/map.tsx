import React from 'react'
import GlobalNodeMap from '@renderer/components/GlobalNodeMap'
import BasePage from '@renderer/components/base/base-page'

const MapPage: React.FC = () => {
  return (
    <BasePage title="节点分布">
       <div className="h-[calc(100vh-50px)] w-full overflow-hidden rounded-xl border border-default-200/50">
          <GlobalNodeMap />
       </div>
    </BasePage>
  )
}

export default MapPage
