import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@heroui/react'
import { IoSettings } from 'react-icons/io5'
import clsx from 'clsx'

import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import ProfileCard from '@renderer/components/sider/profile-card'
import ProxyCard from '@renderer/components/sider/proxy-card'
import RuleCard from '@renderer/components/sider/rule-card'
import ConnCard from '@renderer/components/sider/conn-card'
import LogCard from '@renderer/components/sider/log-card'
import MihomoCoreCard from '@renderer/components/sider/mihomo-core-card'
import SubStoreCard from '@renderer/components/sider/substore-card'
import StatsCard from '@renderer/components/sider/stats-card'
import ToolsCard from '@renderer/components/sider/tools-card'
import MapCard from '@renderer/components/sider/map-card'
import UpdaterButton from '@renderer/components/updater/updater-button'
import MihomoIcon from '@renderer/components/base/mihomo-icon'

import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { CARD_STYLES } from '@renderer/utils/card-styles'

interface LatestVersion {
  version: string
  releaseNotes: string
}

interface AppSidebarProps {
  width: number
  narrowWidth: number
  isNarrow?: boolean
  latest?: LatestVersion
}

const AppSidebar = React.forwardRef<HTMLDivElement, AppSidebarProps>(
  ({ width, narrowWidth, latest }, ref) => {
    const navigate = useNavigate()
    const location = useLocation()
    const { appConfig } = useAppConfig()
    const {
      useWindowFrame = false,
      disableAnimation = false,
      useSubStore = true
    } = appConfig || {}


    const isNarrow = width === narrowWidth

    if (isNarrow) {
      return (
        <div
          ref={ref}
          style={{ width: 'var(--sider-width)' }}
          className="side h-full flex flex-col bg-default-100/50 backdrop-blur-2xl border-r border-default-200/50 dark:border-white/5 transition-all duration-300"
        >
          <div className="app-drag flex justify-center items-center z-40 bg-transparent h-[49px] shrink-0">
            {platform !== 'darwin' && (
              <MihomoIcon className="h-[32px] leading-[32px] text-lg" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar px-1">
            <div className="flex flex-col gap-2 py-1">
              <SysproxySwitcher iconOnly />
              <TunSwitcher iconOnly />
              <ProxyCard iconOnly />
              <ConnCard iconOnly />
              <ProfileCard iconOnly />
              <MihomoCoreCard iconOnly />
              <RuleCard iconOnly />
              <StatsCard iconOnly />
              <ToolsCard iconOnly />
              <LogCard iconOnly />
              <MapCard iconOnly />
              <SubStoreCard iconOnly />
            </div>
          </div>
          <div className="p-2 flex flex-col items-center gap-2 shrink-0 border-t border-divider">
            {latest && latest.version && <UpdaterButton iconOnly={true} latest={latest} />}
            <OutboundModeSwitcher iconOnly />
            <Button
              size="sm"
              className="app-nodrag"
              isIconOnly
              color={location.pathname.includes('/settings') ? 'primary' : 'default'}
              variant={location.pathname.includes('/settings') ? 'solid' : 'light'}
              onPress={() => navigate('/settings')}
            >
              <IoSettings className="text-[20px]" />
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        style={{ width: 'var(--sider-width)' }}
        className="side h-full overflow-y-auto no-scrollbar bg-default-100/50 backdrop-blur-2xl border-r border-default-200/50 dark:border-white/5 transition-all duration-300 flex flex-col"
      >
        <div
          className={`app-drag sticky top-0 z-40 ${disableAnimation ? 'bg-background/95 backdrop-blur-sm' : 'bg-transparent backdrop-blur'} h-[49px] shrink-0`}
          style={{ width: '100%' }}
        >
          <div
            className={`flex items-center justify-between p-2 ${!useWindowFrame && platform === 'darwin' ? 'ml-[60px]' : ''}`}
          >
            <div className="flex min-w-0 items-center gap-2 pl-1 justify-self-start">
              <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                RouteX
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {latest && latest.version && <UpdaterButton latest={latest} />}
              <Button
                size="sm"
                className="app-nodrag group"
                isIconOnly
                variant="light"
                onPress={() => {
                  navigate('/settings')
                }}
              >
                <IoSettings
                  className={`text-[20px] transition-all duration-300 group-hover:rotate-90 group-hover:text-primary group-hover:drop-shadow-[0_0_4px_rgba(0,112,243,0.4)] ${location.pathname.includes('/settings') ? 'text-primary' : 'text-slate-500'}`}
                />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 p-2 flex-1">
          {/* Main Control Center */}
          <div className={clsx("flex flex-col gap-1.5 p-2", CARD_STYLES.ROUNDED, CARD_STYLES.INACTIVE)}>
            <OutboundModeSwitcher isMinimal />
            <div className="h-[1px] mx-2 my-0.5 bg-default-200/55 dark:bg-white/10" />
            <div className="flex h-[80px] flex-col gap-1.5">
              <SysproxySwitcher compact />
              <TunSwitcher compact />
            </div>
          </div>

          {/* Core State Area */}
          <div className="flex flex-col gap-2">
            <ProxyCard />
            <ConnCard />
          </div>

          {/* Configuration Area */}
          <div className={`flex h-[180px] shrink-0 flex-col gap-1.5 px-2.5 py-2 ${CARD_STYLES.ROUNDED} ${CARD_STYLES.INACTIVE}`}>
            <ProfileCard compact className="flex-1" />
            <MihomoCoreCard compact className="flex-1" />
            <RuleCard compact className="flex-1" />
          </div>

          {/* Navigation Menu Area */}
          <div className={`flex flex-col gap-2 px-2.5 py-2 ${CARD_STYLES.ROUNDED} ${CARD_STYLES.INACTIVE}`}>
            <StatsCard />
            <ToolsCard />
            <LogCard />
            <MapCard />
            {useSubStore && <SubStoreCard />}
          </div>
        </div>
      </div>
    )
  }
)

AppSidebar.displayName = 'AppSidebar'

export default AppSidebar
