import React from 'react'
import { Navigate, type NavigateFunction } from 'react-router-dom'
import { RulesProvider } from '@renderer/hooks/use-rules'
import { OverrideConfigProvider } from '@renderer/hooks/use-override-config'

const Proxies = React.lazy(() => import('@renderer/pages/proxies'))
const Rules = React.lazy(() => import('@renderer/pages/rules'))
const Settings = React.lazy(() => import('@renderer/pages/settings'))
const Profiles = React.lazy(() => import('@renderer/pages/profiles'))
const Logs = React.lazy(() => import('@renderer/pages/logs'))
const Connections = React.lazy(() => import('@renderer/pages/connections'))
const Mihomo = React.lazy(() => import('@renderer/pages/mihomo'))
const Sysproxy = React.lazy(() => import('@renderer/pages/sysproxy'))
const Tun = React.lazy(() => import('@renderer/pages/tun'))
const DNS = React.lazy(() => import('@renderer/pages/dns'))
const Sniffer = React.lazy(() => import('@renderer/pages/sniffer'))
const Stats = React.lazy(() => import('@renderer/pages/stats'))
const Tools = React.lazy(() => import('@renderer/pages/tools'))
const MapPage = React.lazy(() => import('@renderer/pages/map'))

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

function LazyRoute({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <React.Suspense fallback={null}>{children}</React.Suspense>
}

function lazyElement(Component: React.LazyExoticComponent<React.ComponentType>): React.JSX.Element {
  return (
    <LazyRoute>
      <Component />
    </LazyRoute>
  )
}

export function navigateSidebarRoute(path: string): void {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  // 通过 React Router 导航时，用模块级状态判断是否重复，
  // 避免 window.location.hash 因渲染未完成而滞后
  if (_navigate) {
    if (_lastNavigatedPath === normalizedPath) {
      console.debug('[nav] skipped duplicate:', normalizedPath)
      return
    }

    const currentPath = _lastNavigatedPath || (window.location.hash?.slice(1) || '/')
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

  window.location.hash = nextHash
}

function RulesRoute(): React.JSX.Element {
  return (
    <LazyRoute>
      <RulesProvider>
        <Rules />
      </RulesProvider>
    </LazyRoute>
  )
}

function ProfilesRoute(): React.JSX.Element {
  return (
    <LazyRoute>
      <OverrideConfigProvider>
        <Profiles />
      </OverrideConfigProvider>
    </LazyRoute>
  )
}

const routes = [
  {
    path: '/mihomo',
    element: lazyElement(Mihomo)
  },
  {
    path: '/sysproxy',
    element: lazyElement(Sysproxy)
  },
  {
    path: '/tun',
    element: lazyElement(Tun)
  },
  {
    path: '/proxies',
    element: lazyElement(Proxies)
  },
  {
    path: '/rules',
    element: <RulesRoute />
  },

  {
    path: '/dns',
    element: lazyElement(DNS)
  },
  {
    path: '/sniffer',
    element: lazyElement(Sniffer)
  },
  {
    path: '/logs',
    element: lazyElement(Logs)
  },
  {
    path: '/connections',
    element: lazyElement(Connections)
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
    element: lazyElement(Settings)
  },
  {
    path: '/stats',
    element: lazyElement(Stats)
  },
  {
    path: '/tools',
    element: lazyElement(Tools)
  },
  {
    path: '/map',
    element: lazyElement(MapPage)
  },
  {
    path: '/',
    element: <Navigate to="/proxies" />
  }
]

export default routes
