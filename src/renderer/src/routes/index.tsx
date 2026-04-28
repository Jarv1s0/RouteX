import React from 'react'
import { Navigate, type NavigateFunction } from 'react-router-dom'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useTrafficStore } from '@renderer/store/use-traffic-store'
import { RulesProvider } from '@renderer/hooks/use-rules'
import { OverrideConfigProvider } from '@renderer/hooks/use-override-config'
import Proxies from '@renderer/pages/proxies'
import Rules from '@renderer/pages/rules'
import Settings from '@renderer/pages/settings'
import Profiles from '@renderer/pages/profiles'
import Logs from '@renderer/pages/logs'
import Connections from '@renderer/pages/connections'
import Mihomo from '@renderer/pages/mihomo'
import Sysproxy from '@renderer/pages/sysproxy'
import Tun from '@renderer/pages/tun'
import DNS from '@renderer/pages/dns'
import Sniffer from '@renderer/pages/sniffer'
import Stats from '@renderer/pages/stats'
import Tools from '@renderer/pages/tools'
import MapPage from '@renderer/pages/map'

// ─── 模块级 navigate 引用，供 navigateSidebarRoute 使用 ───
let _navigate: NavigateFunction | null = null

export function setRouterNavigate(fn: NavigateFunction, currentPath?: string): void {
  _navigate = fn
  // 同步当前路径，确保 _lastNavigatedPath 与 React Router 内部状态一致
  if (currentPath) {
    _lastNavigatedPath = currentPath
  }
}

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
