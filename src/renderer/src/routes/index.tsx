import React from 'react'
import { Navigate, type NavigateFunction } from 'react-router-dom'
import { RulesProvider } from '@renderer/hooks/use-rules'
import { OverrideConfigProvider } from '@renderer/hooks/use-override-config'
import { debugLog } from '@renderer/utils/logger'
import Connections from '@renderer/pages/connections'

type LazyRouteModule = { default: React.ComponentType }

const routeLoaders: Record<string, () => Promise<LazyRouteModule>> = {
  '/mihomo': () => import('@renderer/pages/mihomo'),
  '/sysproxy': () => import('@renderer/pages/sysproxy'),
  '/tun': () => import('@renderer/pages/tun'),
  '/proxies': () => import('@renderer/pages/proxies'),
  '/rules': () => import('@renderer/pages/rules'),
  '/dns': () => import('@renderer/pages/dns'),
  '/sniffer': () => import('@renderer/pages/sniffer'),
  '/logs': () => import('@renderer/pages/logs'),
  '/profiles': () => import('@renderer/pages/profiles'),
  '/settings': () => import('@renderer/pages/settings'),
  '/stats': () => import('@renderer/pages/stats'),
  '/tools': () => import('@renderer/pages/tools'),
  '/map': () => import('@renderer/pages/map')
}

const preloadedRoutes = new Set<string>()

function getRoutePath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return normalizedPath.split('?')[0]
}

export function preloadSidebarRoute(path: string): void {
  const routePath = getRoutePath(path)
  const loader = routeLoaders[routePath]

  if (!loader || preloadedRoutes.has(routePath)) {
    return
  }

  preloadedRoutes.add(routePath)
  void loader().catch(() => {
    preloadedRoutes.delete(routePath)
  })
}

export function preloadSidebarRoutes(): void {
  const preloadQueue = ['/proxies', '/connections', '/profiles', '/rules', '/settings']

  const scheduleNext = (): void => {
    const path = preloadQueue.shift()
    if (!path || document.hidden) {
      return
    }

    preloadSidebarRoute(path)

    if (preloadQueue.length > 0) {
      window.setTimeout(scheduleNext, 600)
    }
  }

  scheduleNext()
}

const Proxies = React.lazy(routeLoaders['/proxies'])
const Rules = React.lazy(routeLoaders['/rules'])
const Settings = React.lazy(routeLoaders['/settings'])
const Profiles = React.lazy(routeLoaders['/profiles'])
const Logs = React.lazy(routeLoaders['/logs'])
const Mihomo = React.lazy(routeLoaders['/mihomo'])
const Sysproxy = React.lazy(routeLoaders['/sysproxy'])
const Tun = React.lazy(routeLoaders['/tun'])
const DNS = React.lazy(routeLoaders['/dns'])
const Sniffer = React.lazy(routeLoaders['/sniffer'])
const Stats = React.lazy(routeLoaders['/stats'])
const Tools = React.lazy(routeLoaders['/tools'])
const MapPage = React.lazy(routeLoaders['/map'])

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
  preloadSidebarRoute(normalizedPath)

  // 通过 React Router 导航时，用模块级状态判断是否重复，
  // 避免 window.location.hash 因渲染未完成而滞后
  if (_navigate) {
    if (_lastNavigatedPath === normalizedPath) {
      debugLog('[nav] skipped duplicate:', normalizedPath)
      return
    }

    const currentPath = _lastNavigatedPath || (window.location.hash?.slice(1) || '/')
    debugLog('[nav]', currentPath, '→', normalizedPath)
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
    element: (
      <LazyRoute>
        <Connections />
      </LazyRoute>
    )
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
