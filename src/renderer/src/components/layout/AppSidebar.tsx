import React, { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { Button } from '@heroui/react'
import { IoSettings } from 'react-icons/io5'


import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import ProfileCard from '@renderer/components/sider/profile-card'
import ProxyCard from '@renderer/components/sider/proxy-card'
import RuleCard from '@renderer/components/sider/rule-card'
import DNSCard from '@renderer/components/sider/dns-card'
import SniffCard from '@renderer/components/sider/sniff-card'
import OverrideCard from '@renderer/components/sider/override-card'
import ConnCard from '@renderer/components/sider/conn-card'
import LogCard from '@renderer/components/sider/log-card'
import MihomoCoreCard from '@renderer/components/sider/mihomo-core-card'
import SubStoreCard from '@renderer/components/sider/substore-card'
import StatsCard from '@renderer/components/sider/stats-card'
import ToolsCard from '@renderer/components/sider/tools-card'
import MapCard from '@renderer/components/sider/map-card'
import UpdaterButton from '@renderer/components/updater/updater-button'
import MihomoIcon from '../base/mihomo-icon'

import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'

const defaultSiderOrder = [
  'sysproxy',
  'tun',
  'dns',
  'sniff',
  'proxy',
  'connection',
  'profile',
  'mihomo',
  'rule',
  'override',
  'log',
  'substore',
  'stats',
  'map',
  'tools'
]

const navigateMap = {
  sysproxy: 'sysproxy',
  tun: 'tun',
  profile: 'profiles',
  proxy: 'proxies',
  mihomo: 'mihomo',
  connection: 'connections',
  dns: 'dns',
  sniff: 'sniffer',
  log: 'logs',
  rule: 'rules',
  override: 'override',
  substore: 'substore',
  stats: 'stats',
  tools: 'tools',
  map: 'map'
}

const componentMap = {
  sysproxy: SysproxySwitcher,
  tun: TunSwitcher,
  profile: ProfileCard,
  proxy: ProxyCard,
  mihomo: MihomoCoreCard,
  connection: ConnCard,
  dns: DNSCard,
  sniff: SniffCard,
  log: LogCard,
  rule: RuleCard,
  override: OverrideCard,
  substore: SubStoreCard,
  stats: StatsCard,
  tools: ToolsCard,
  map: MapCard
}

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
    const { appConfig, patchAppConfig } = useAppConfig()
    const {
      siderOrder,
      useWindowFrame = false,
      disableAnimation = false
    } = appConfig || {}

    const siderOrderArray = siderOrder ?? defaultSiderOrder
    const mergedSiderOrder = useMemo(() => {
      let result = siderOrderArray
      if (!result.includes('stats')) {
        result = [...result, 'stats']
      }
      if (!result.includes('tools')) {
        result = [...result, 'tools']
      }
      if (!result.includes('substore')) {
        result = [...result, 'substore']
      }
      if (!result.includes('map')) {
        result = [...result, 'map']
      }
      return result
    }, [siderOrderArray])

    const [order, setOrder] = useState(mergedSiderOrder)
    const sensors = useSensors(useSensor(PointerSensor))

    useEffect(() => {
      setOrder(mergedSiderOrder)
    }, [mergedSiderOrder])

    const onDragEnd = async (event: DragEndEvent): Promise<void> => {
      const { active, over } = event
      if (over) {
        if (active.id !== over.id) {
          const newOrder = order.slice()
          const activeIndex = newOrder.indexOf(active.id as string)
          const overIndex = newOrder.indexOf(over.id as string)
          newOrder.splice(activeIndex, 1)
          newOrder.splice(overIndex, 0, active.id as string)
          setOrder(newOrder)
          await patchAppConfig({ siderOrder: newOrder })
          return
        }
      }
      navigate(navigateMap[active.id as string])
    }

    const isNarrow = width === narrowWidth

    if (isNarrow) {
      return (
        <div
          ref={ref}
          style={{ width: `${width}px` }}
          className="side h-full flex flex-col bg-default-100/50 backdrop-blur-2xl border-r border-default-200/50 dark:border-white/5 transition-all duration-300"
        >
          <div className="app-drag flex justify-center items-center z-40 bg-transparent h-[49px] shrink-0">
            {platform !== 'darwin' && (
              <MihomoIcon className="h-[32px] leading-[32px] text-lg" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar px-1">
            <div className="flex flex-col gap-2 py-1">
              {order.map((key: string) => {
                const Component = componentMap[key]
                if (!Component) return null
                return <Component key={key} iconOnly={true} />
              })}
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
        style={{ width: `${width}px` }}
        className="side h-full overflow-y-auto no-scrollbar bg-default-100/50 backdrop-blur-2xl border-r border-default-200/50 dark:border-white/5 transition-all duration-300"
      >
        <div
          className={`app-drag sticky top-0 z-40 ${disableAnimation ? 'bg-background/95 backdrop-blur-sm' : 'bg-transparent backdrop-blur'} h-[49px]`}
          style={{ width: '100%' }}
        >
          <div
            className={`flex justify-between items-center p-2 ${!useWindowFrame && platform === 'darwin' ? 'ml-[60px]' : ''}`}
          >
            <div className="flex ml-1 items-center gap-2">
              <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-600 bg-clip-text text-transparent">
                RouteX
              </h3>
            </div>
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
        <div className="mt-0 mx-2">
          <OutboundModeSwitcher />
        </div>
        <div style={{ overflowX: 'clip' }}>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-2 gap-2 m-2">
              <SortableContext items={order}>
                {order.map((key: string) => {
                  const Component = componentMap[key]
                  if (!Component) return null
                  return <Component key={key} />
                })}
              </SortableContext>
            </div>
          </DndContext>
        </div>
      </div>
    )
  }
)

AppSidebar.displayName = 'AppSidebar'

export default AppSidebar
