import { useTheme } from 'next-themes'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useRoutes } from 'react-router-dom'
import routes, { setRouterNavigate } from '@renderer/routes'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useTrafficStore } from '@renderer/store/use-traffic-store'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'

import ErrorBoundary from '@renderer/components/base/error-boundary'
import { ConnectionsSkeleton } from '@renderer/components/skeletons/ConnectionsSkeleton'
import { ProxiesSkeleton } from '@renderer/components/skeletons/ProxiesSkeleton'
import { RulesSkeleton } from '@renderer/components/skeletons/RulesSkeleton'
import { LogsSkeleton } from '@renderer/components/skeletons/LogsSkeleton'
import { StatsSkeleton } from '@renderer/components/skeletons/StatsSkeleton'

const SIDER_WIDTH_CSS_VAR = '--sider-width'
const AppSidebar = React.lazy(() => import('@renderer/components/layout/AppSidebar'))
const GlobalConfirmModals = React.lazy(() => import('@renderer/components/base/GlobalConfirmModals'))
const GlobalDialogModal = React.lazy(() =>
  import('@renderer/components/base/global-dialog-modal').then((module) => ({
    default: module.GlobalDialogModal
  }))
)

function scheduleDeferredTask(task: () => void, delay = 0): () => void {
  const timeoutId = window.setTimeout(task, delay)
  return () => window.clearTimeout(timeoutId)
}

function scheduleIdleDeferredTask(task: () => void, delay = 0, timeout = 4000): () => void {
  let idleId: number | null = null
  const win = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number
    cancelIdleCallback?: (handle: number) => void
  }

  const timeoutId = window.setTimeout(() => {
    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(() => task(), { timeout })
      return
    }

    idleId = window.setTimeout(task, 0)
  }, delay)

  return () => {
    window.clearTimeout(timeoutId)
    if (idleId === null) {
      return
    }

    if (typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleId)
      return
    }

    window.clearTimeout(idleId)
  }
}

async function checkUpdateSafely(): Promise<AppVersion | undefined> {
  const { checkUpdate } = await import('@renderer/api/app')
  return checkUpdate()
}

async function setNativeThemeSafely(theme: 'system' | 'light' | 'dark'): Promise<void> {
  const { setNativeTheme } = await import('@renderer/api/app')
  await setNativeTheme(theme)
}

async function applyThemeSafely(theme: string): Promise<void> {
  const { applyTheme } = await import('@renderer/utils/theme-ipc')
  await applyTheme(theme)
}

async function startTauriMihomoBridgeSafely(): Promise<void> {
  const { startTauriMihomoEventBridge } = await import('@renderer/utils/mihomo-ipc')
  const { ensureTauriTrafficRecorder } = await import('@renderer/utils/tauri-traffic-stats')
  startTauriMihomoEventBridge()
  ensureTauriTrafficRecorder()
}

const App: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    appTheme = 'system',
    customTheme,
    siderWidth = 250,
    autoCheckUpdate,
    updateChannel = 'stable',
    sysProxy,
    collapseSidebar = false
  } = appConfig || {}
  const { controledMihomoConfig } = useControledMihomoConfig()

  const narrowWidth = platform === 'darwin' ? 70 : 60
  const initialSiderWidth = collapseSidebar ? narrowWidth : siderWidth

  const [siderWidthValue, setSiderWidthValue] = useState(initialSiderWidth)
  const siderWidthValueRef = useRef(siderWidthValue)
  const [resizing, setResizing] = useState(false)
  const resizingRef = useRef(resizing)

  const sideRef = useRef<HTMLDivElement>(null)
  const resizerRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const pendingWidthRef = useRef(initialSiderWidth)

  const { setTheme, systemTheme } = useTheme()
  const routerNavigate = useNavigate()
  const location = useLocation()
  setRouterNavigate(routerNavigate, location.pathname)
  const page = useRoutes(routes)
  const connectionsListenerActiveRef = useRef(false)
  const trafficListenerActiveRef = useRef(false)
  const pendingConnectionsInitCleanupRef = useRef<(() => void) | null>(null)
  const pendingTrafficInitCleanupRef = useRef<(() => void) | null>(null)
  const lastUpdateCheckAtRef = useRef(0)
  const [latest, setLatest] = useState<AppVersion | undefined>()

  useEffect(() => {
    if (!autoCheckUpdate) {
      setLatest(undefined)
      lastUpdateCheckAtRef.current = 0
      return
    }

    let cancelled = false
    const MIN_CHECK_INTERVAL = 1000 * 60 * 10

    const runUpdateCheck = async (force = false): Promise<void> => {
      const now = Date.now()
      if (!force && now - lastUpdateCheckAtRef.current < MIN_CHECK_INTERVAL) {
        return
      }

      lastUpdateCheckAtRef.current = now

      try {
        const nextLatest = await checkUpdateSafely()
        if (!cancelled) {
          setLatest(nextLatest)
        }
      } catch {
        if (!cancelled) {
          setLatest(undefined)
        }
      }
    }

    const cancelInitialCheck = scheduleIdleDeferredTask(() => {
      if (!document.hidden) {
        void runUpdateCheck(true)
      }
    }, 15000)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void runUpdateCheck()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      cancelInitialCheck()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [autoCheckUpdate, updateChannel])

  useEffect(() => {
    const nextWidth = collapseSidebar ? narrowWidth : siderWidth
    setSiderWidthValue(nextWidth)
  }, [collapseSidebar, narrowWidth, siderWidth])

  useEffect(() => {
    if (__ROUTEX_HOST__ !== 'tauri') {
      return
    }

    const cancelBridgeStart = scheduleDeferredTask(() => {
      void startTauriMihomoBridgeSafely()
    }, 80)

    return () => {
      cancelBridgeStart()
    }
  }, [])

  useEffect(() => {
    siderWidthValueRef.current = siderWidthValue
    resizingRef.current = resizing
  }, [siderWidthValue, resizing])

  useEffect(() => {
    pendingWidthRef.current = siderWidthValue
    layoutRef.current?.style.setProperty(SIDER_WIDTH_CSS_VAR, `${siderWidthValue}px`)
  }, [siderWidthValue])

  useEffect(() => {
    if (!appConfig) {
      return
    }
    void setNativeThemeSafely(appTheme)
    setTheme(appTheme)
  }, [appConfig, appTheme, setTheme, systemTheme])

  useEffect(() => {
    if (!appConfig) {
      return
    }
    void applyThemeSafely(customTheme || 'CoolApk.css')
  }, [appConfig, customTheme])

  useEffect(() => {
    if (__ROUTEX_HOST__ === 'tauri') {
      return
    }

    const tunEnabled = controledMihomoConfig?.tun?.enable
    const sysProxyEnabled = sysProxy?.enable

    if (!appConfig || !controledMihomoConfig) {
      return
    }

    if (tunEnabled) {
      sendIpc(SEND.updateTaskbarIcon, 'tun')
    } else if (sysProxyEnabled) {
      sendIpc(SEND.updateTaskbarIcon, 'proxy')
    } else {
      sendIpc(SEND.updateTaskbarIcon, 'default')
    }
  }, [appConfig, controledMihomoConfig, sysProxy?.enable])

  const syncStoreListeners = useCallback(() => {
    const pathname = location.pathname
    const needsConnections =
      pathname.includes('/connections') || pathname.includes('/map') || pathname.includes('/stats')
    const needsTraffic = pathname.includes('/stats')
    const isStatsPage = pathname.includes('/stats')

    pendingConnectionsInitCleanupRef.current?.()
    pendingConnectionsInitCleanupRef.current = null
    pendingTrafficInitCleanupRef.current?.()
    pendingTrafficInitCleanupRef.current = null

    if (needsConnections && !connectionsListenerActiveRef.current) {
      const initializeConnections = () => {
        useConnectionsStore.getState().initializeListeners()
        connectionsListenerActiveRef.current = true
      }

      if (isStatsPage) {
        pendingConnectionsInitCleanupRef.current = scheduleDeferredTask(initializeConnections, 120)
      } else {
        initializeConnections()
      }
    } else if (!needsConnections && connectionsListenerActiveRef.current) {
      useConnectionsStore.getState().cleanupListeners()
      connectionsListenerActiveRef.current = false
    }

    if (needsTraffic && !trafficListenerActiveRef.current) {
      pendingTrafficInitCleanupRef.current = scheduleDeferredTask(() => {
        useTrafficStore.getState().initializeListeners()
        trafficListenerActiveRef.current = true
      }, 180)
    } else if (!needsTraffic && trafficListenerActiveRef.current) {
      useTrafficStore.getState().cleanupListeners()
      trafficListenerActiveRef.current = false
    }
  }, [location.pathname])

  const onResizeEnd = useCallback((): void => {
    if (resizingRef.current) {
      setResizing(false)
      const finalWidth = pendingWidthRef.current
      siderWidthValueRef.current = finalWidth
      setSiderWidthValue(finalWidth)
      patchAppConfig({ siderWidth: finalWidth, collapseSidebar: finalWidth === narrowWidth })
    }
  }, [narrowWidth, patchAppConfig])

  useEffect(() => {
    window.addEventListener('mouseup', onResizeEnd)

    return (): void => {
      window.removeEventListener('mouseup', onResizeEnd)
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      pendingConnectionsInitCleanupRef.current?.()
      pendingConnectionsInitCleanupRef.current = null
      pendingTrafficInitCleanupRef.current?.()
      pendingTrafficInitCleanupRef.current = null
      if (connectionsListenerActiveRef.current) {
        useConnectionsStore.getState().cleanupListeners()
        connectionsListenerActiveRef.current = false
      }
      if (trafficListenerActiveRef.current) {
        useTrafficStore.getState().cleanupListeners()
        trafficListenerActiveRef.current = false
      }
    }
  }, [onResizeEnd])

  useEffect(() => {
    syncStoreListeners()
  }, [syncStoreListeners])

  const getFallback = (path: string) => {
    if (path.includes('/connections')) {
      return <ConnectionsSkeleton />
    }
    if (path.includes('/proxies')) {
      return <ProxiesSkeleton />
    }
    if (path.includes('/rules')) {
      return <RulesSkeleton />
    }
    if (path.includes('/logs')) {
      return <LogsSkeleton />
    }
    if (path.includes('/stats')) {
      return <StatsSkeleton />
    }
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <React.Suspense fallback={null}>
        <GlobalConfirmModals />
        <GlobalDialogModal />
      </React.Suspense>

      <div
        ref={layoutRef}
        style={{ [SIDER_WIDTH_CSS_VAR]: `${siderWidthValue}px` } as React.CSSProperties}
        onMouseMove={(e) => {
          if (!resizing) {
            return
          }

          e.preventDefault()
          let newWidth = e.clientX

          if (newWidth <= 150) {
            newWidth = narrowWidth
          } else if (newWidth <= 250) {
            newWidth = 250
          } else if (newWidth >= 400) {
            newWidth = 400
          }

          pendingWidthRef.current = newWidth
          siderWidthValueRef.current = newWidth

          if (resizeFrameRef.current === null) {
            resizeFrameRef.current = window.requestAnimationFrame(() => {
              layoutRef.current?.style.setProperty(
                SIDER_WIDTH_CSS_VAR,
                `${pendingWidthRef.current}px`
              )
              resizeFrameRef.current = null
            })
          }
        }}
        className={`flex h-screen w-full ${resizing ? 'cursor-ew-resize select-none' : ''}`}
      >
        <React.Suspense
          fallback={
            <div
              style={{ width: 'var(--sider-width)' }}
              className="side h-full shrink-0 border-r border-default-200/50 bg-default-100/50 dark:border-white/5"
            />
          }
        >
          <AppSidebar
            ref={sideRef}
            width={siderWidthValue}
            narrowWidth={narrowWidth}
            latest={latest}
          />
        </React.Suspense>

        <div
          ref={resizerRef}
          onMouseDown={() => {
            setResizing(true)
          }}
          style={{
            position: 'fixed',
            zIndex: 50,
            left: `calc(var(${SIDER_WIDTH_CSS_VAR}) - 2px)`,
            width: '5px',
            height: '100vh',
            cursor: 'ew-resize'
          }}
          className={`transition-colors duration-200 hover:bg-primary/50 ${resizing ? 'bg-primary' : ''}`}
        />

        <div
          ref={mainRef}
          className="main relative z-0 min-w-0 flex-1 h-full overflow-y-auto"
        >
          <ErrorBoundary>
            <React.Suspense fallback={getFallback(location.pathname)}>
              {page}
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
}

export default App
