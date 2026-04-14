import React from 'react'
import { Navigate, type NavigateFunction } from 'react-router-dom'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useTrafficStore } from '@renderer/store/use-traffic-store'
import { RulesProvider } from '@renderer/hooks/use-rules'
import { OverrideConfigProvider } from '@renderer/hooks/use-override-config'

// ─── 模块级 navigate 引用，供 navigateSidebarRoute 使用 ───
let _navigate: NavigateFunction | null = null

export function setRouterNavigate(fn: NavigateFunction, currentPath?: string): void {
  _navigate = fn
  // 同步当前路径，确保 _lastNavigatedPath 与 React Router 内部状态一致
  if (currentPath) {
    _lastNavigatedPath = currentPath
  }
}

const loadProxies = () => import('@renderer/pages/proxies')
const loadRules = () => import('@renderer/pages/rules')
const loadSettings = () => import('@renderer/pages/settings')
const loadProfiles = () => import('@renderer/pages/profiles')
const loadLogs = () => import('@renderer/pages/logs')
const loadConnections = () => import('@renderer/pages/connections')
const loadMihomo = () => import('@renderer/pages/mihomo')
const loadSysproxy = () => import('@renderer/pages/sysproxy')
const loadTun = () => import('@renderer/pages/tun')

const loadDNS = () => import('@renderer/pages/dns')
const loadSniffer = () => import('@renderer/pages/sniffer')
const loadStats = () => import('@renderer/pages/stats')
const loadTools = () => import('@renderer/pages/tools')
const loadMap = () => import('@renderer/pages/map')

// 记录最后一次导航的目标路径，避免 window.location.hash 与 React Router 内部状态不同步
let _lastNavigatedPath: string | null = null

export function navigateSidebarRoute(path: string): void {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  // 通过 React Router 导航时，用模块级状态判断是否重复，
  // 避免 window.location.hash 因渲染未完成而滞后
  if (_navigate) {
    if (_lastNavigatedPath === normalizedPath) {
      console.debug('[nav] skipped duplicate:', normalizedPath)
      return
    }

    // 在导航前处理需要的清理逻辑
    const currentPath = _lastNavigatedPath || (window.location.hash?.slice(1) || '/')
    const leavingConnectionsScope =
      (currentPath.includes('/connections') || currentPath.includes('/map') || currentPath.includes('/stats')) &&
      !normalizedPath.includes('/connections') &&
      !normalizedPath.includes('/map') &&
      !normalizedPath.includes('/stats')
    const leavingStatsScope = currentPath.includes('/stats') && !normalizedPath.includes('/stats')

    if (leavingConnectionsScope) {
      useConnectionsStore.getState().cleanupListeners()
    }

    if (leavingStatsScope) {
      useTrafficStore.getState().cleanupListeners()
    }

    console.debug('[nav]', currentPath, '→', normalizedPath)
    _lastNavigatedPath = normalizedPath
    _navigate(normalizedPath)
    return
  }

  // fallback: 模块尚未初始化时使用 hash 导航
  const nextHash = `#${normalizedPath}`
  const currentHash = window.location.hash || '#/'

  if (currentHash === nextHash) {
    return
  }

  const currentPath = currentHash.startsWith('#') ? currentHash.slice(1) || '/' : currentHash
  const leavingConnectionsScope =
    (currentPath.includes('/connections') || currentPath.includes('/map') || currentPath.includes('/stats')) &&
    !normalizedPath.includes('/connections') &&
    !normalizedPath.includes('/map') &&
    !normalizedPath.includes('/stats')
  const leavingStatsScope = currentPath.includes('/stats') && !normalizedPath.includes('/stats')

  if (leavingConnectionsScope) {
    useConnectionsStore.getState().cleanupListeners()
  }

  if (leavingStatsScope) {
    useTrafficStore.getState().cleanupListeners()
  }

  window.location.hash = nextHash
}

const Proxies = React.lazy(loadProxies)
const Rules = React.lazy(loadRules)
const Settings = React.lazy(loadSettings)
const Profiles = React.lazy(loadProfiles)
const Logs = React.lazy(loadLogs)
const Connections = React.lazy(loadConnections)
const Mihomo = React.lazy(loadMihomo)
const Sysproxy = React.lazy(loadSysproxy)
const Tun = React.lazy(loadTun)

const DNS = React.lazy(loadDNS)
const Sniffer = React.lazy(loadSniffer)
const Stats = React.lazy(loadStats)
const Tools = React.lazy(loadTools)
const MapPage = React.lazy(loadMap)

function RulesRoute(): React.JSX.Element {
  return (
    <RulesProvider>
      <Rules />
    </RulesProvider>
  )
}

function ProfilesRoute(): React.JSX.Element {
  return (
    <OverrideConfigProvider>
      <Profiles />
    </OverrideConfigProvider>
  )
}

const routes = [
  {
    path: '/mihomo',
    element: <Mihomo />
  },
  {
    path: '/sysproxy',
    element: <Sysproxy />
  },
  {
    path: '/tun',
    element: <Tun />
  },
  {
    path: '/proxies',
    element: <Proxies />
  },
  {
    path: '/rules',
    element: <RulesRoute />
  },

  {
    path: '/dns',
    element: <DNS />
  },
  {
    path: '/sniffer',
    element: <Sniffer />
  },
  {
    path: '/logs',
    element: <Logs />
  },
  {
    path: '/connections',
    element: <Connections />
  },
  {
    path: '/override',
    element: <Navigate to="/profiles?tab=overrides" replace />
  },
  {
    path: '/profiles',
    element: <ProfilesRoute />
  },
  {
    path: '/settings',
    element: <Settings />
  },
  {
    path: '/stats',
    element: <Stats />
  },
  {
    path: '/tools',
    element: <Tools />
  },
  {
    path: '/map',
    element: <MapPage />
  },
  {
    path: '/',
    element: <Navigate to="/proxies" />
  }
]

export default routes
