import React, { useState, useEffect } from 'react'
import GlobalNodeMap from '@renderer/components/GlobalNodeMap'
import TopologyMap from '@renderer/components/TopologyMap'
import BasePage from '@renderer/components/base/base-page'
import { Tabs, Tab } from '@heroui/react'
import { IoEarth, IoGitNetworkOutline } from 'react-icons/io5'
import { CARD_STYLES } from '@renderer/utils/card-styles'

const MapPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => {
      return localStorage.getItem('map_active_tab') || 'geo'
  })

  useEffect(() => {
      localStorage.setItem('map_active_tab', activeTab)
  }, [activeTab])

  return (
    <BasePage title="网络拓扑">
       <div className="sticky top-0 z-40 bg-transparent w-full pb-2 px-2 pt-2 pointer-events-none">
        <div className={`w-full px-2 py-1.5 flex items-center gap-2 pointer-events-auto ${CARD_STYLES.GLASS_TOOLBAR} ${CARD_STYLES.ROUNDED}`}>
          <Tabs
            size="md"
            variant="solid"
            radius="lg"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            classNames={CARD_STYLES.GLASS_TABS}
          >
            <Tab
              key="geo"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoEarth className="text-lg" />
                  <span>地理分布</span>
                </div>
              }
            />

            <Tab
              key="topology"
              title={
                <div className="flex items-center gap-2 px-1">
                  <IoGitNetworkOutline className="text-lg" />
                  <span>网络拓扑</span>
                </div>
              }
            />
          </Tabs>
        </div>
      </div>

       <div className="h-[calc(100vh-110px)] w-full overflow-hidden rounded-xl border border-default-200/50 relative">
          {activeTab === 'geo' && <GlobalNodeMap />}
          {activeTab === 'topology' && <TopologyMap />}
       </div>
    </BasePage>
  )
}

export default MapPage
