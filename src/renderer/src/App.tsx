import { useTheme } from 'next-themes'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { NavigateFunction, useLocation, useNavigate, useRoutes } from 'react-router-dom'
import PageTransition from '@renderer/components/base/page-transition'
import routes from '@renderer/routes'
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

let navigate: NavigateFunction
const SIDER_WIDTH_CSS_VAR = '--sider-width'
const AppSidebar = React.lazy(() => import('@renderer/components/layout/AppSidebar'))
const GlobalConfirmModals = React.lazy(() => import('@renderer/components/base/GlobalConfirmModals'))
const GlobalDialogModal = React.lazy(() =>
  import('@renderer/components/base/global-dialog-modal').then((module) => ({
    default: module.GlobalDialogModal
  }))
)

async function checkUpdateSafely(): Promise<AppVersion | undefined> {
  const { checkUpdate } = await import('@renderer/utils/app-ipc')
  return checkUpdate()
}

async function setNativeThemeSafely(theme: 'system' | 'light' | 'dark'): Promise<void> {
  const { setNativeTheme } = await import('@renderer/utils/app-ipc')
  await setNativeTheme(theme)
}

async function applyThemeSafely(theme: string): Promise<void> {
  const { applyTheme } = await import('@renderer/utils/theme-ipc')
  await applyTheme(theme)
}

const App: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    appTheme = 'system',
    customTheme,
    siderWidth = 250,
    autoCheckUpdate,
    updateChannel = 'stable',
    sysProxy
  } = appConfig || {}
  const { controledMihomoConfig } = useControledMihomoConfig()

  const narrowWidth = platform === 'darwin' ? 70 : 60
  
  // 初始值固定为 250，避免闪烁
  const [siderWidthValue, setSiderWidthValue] = useState(siderWidth)
  const siderWidthValueRef = useRef(siderWidthValue)
  const [resizing, setResizing] = useState(false)
  const resizingRef = useRef(resizing)
  
  const sideRef = useRef<HTMLDivElement>(null)
  const resizerRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const pendingWidthRef = useRef(siderWidth)

  const { setTheme, systemTheme } = useTheme()
  navigate = useNavigate()
  const location = useLocation()
  const page = useRoutes(routes)
  const connectionsListenerActiveRef = useRef(false)
  const trafficListenerActiveRef = useRef(false)
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

    void runUpdateCheck(true)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void runUpdateCheck()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [autoCheckUpdate, updateChannel])

  useEffect(() => {
    setSiderWidthValue(siderWidth)
  }, [siderWidth])

  useEffect(() => {
    siderWidthValueRef.current = siderWidthValue
    resizingRef.current = resizing
  }, [siderWidthValue, resizing])

  useEffect(() => {
    pendingWidthRef.current = siderWidthValue
    layoutRef.current?.style.setProperty(SIDER_WIDTH_CSS_VAR, `${siderWidthValue}px`)
  }, [siderWidthValue])

  useEffect(() => {
    const tourShown = window.localStorage.getItem('tourShown')
    if (!tourShown) {
      window.localStorage.setItem('tourShown', 'true')
      import('@renderer/utils/driver').then(({ startTour }) => {
        startTour(navigate)
      })
    }
  }, [])

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
    void applyThemeSafely(customTheme || 'default.css')
  }, [appConfig, customTheme])

  useEffect(() => {
    // Sync Taskbar Icon
    const tunEnabled = controledMihomoConfig?.tun?.enable
    const sysProxyEnabled = sysProxy?.enable

    // Prevent premature updates if config is not yet loaded
    if (!appConfig || !controledMihomoConfig) return

    if (tunEnabled) {
      sendIpc(SEND.updateTaskbarIcon, 'tun')
    } else if (sysProxyEnabled) {
      sendIpc(SEND.updateTaskbarIcon, 'proxy')
    } else {
      sendIpc(SEND.updateTaskbarIcon, 'default')
    }
  }, [controledMihomoConfig?.tun?.enable, sysProxy?.enable])

  const syncStoreListeners = useCallback(() => {
    const pathname = location.pathname
    const needsConnections =
      pathname.includes('/connections') || pathname.includes('/map') || pathname.includes('/stats')
    const needsTraffic = pathname.includes('/stats')

    if (needsConnections && !connectionsListenerActiveRef.current) {
      useConnectionsStore.getState().initializeListeners()
      connectionsListenerActiveRef.current = true
    } else if (!needsConnections && connectionsListenerActiveRef.current) {
      useConnectionsStore.getState().cleanupListeners()
      connectionsListenerActiveRef.current = false
    }

    if (needsTraffic && !trafficListenerActiveRef.current) {
      useTrafficStore.getState().initializeListeners()
      trafficListenerActiveRef.current = true
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
      patchAppConfig({ siderWidth: finalWidth })
    }
  }, [patchAppConfig])

  useEffect(() => {
    window.addEventListener('mouseup', onResizeEnd)

    return (): void => {
      window.removeEventListener('mouseup', onResizeEnd)
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
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
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
// ... rest of the file ...
        onMouseMove={(e) => {
          if (!resizing) return
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
        className={`w-full h-screen flex ${resizing ? 'cursor-ew-resize select-none' : ''}`}
      >
        <React.Suspense
          fallback={
            <div
              style={{ width: 'var(--sider-width)' }}
              className="side h-full bg-default-100/50 border-r border-default-200/50 dark:border-white/5"
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
          style={{ width: `calc(100% - var(${SIDER_WIDTH_CSS_VAR}) - 1px)` }}
          className="main grow h-full overflow-y-auto"
        >
          <ErrorBoundary>
            <React.Suspense fallback={getFallback(location.pathname)}>
              <PageTransition key={location.pathname}>{page}</PageTransition>
            </React.Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
}

export default App
