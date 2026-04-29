import { useTheme } from 'next-themes'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useRoutes } from 'react-router-dom'
import routes, { setRouterNavigate } from '@renderer/routes'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { releaseLogsListeners, retainLogsListeners } from '@renderer/store/use-logs-store'
import { useTrafficStore } from '@renderer/store/use-traffic-store'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { SEND, sendIpc } from '@renderer/utils/ipc-channels'
import { checkUpdate, setNativeTheme } from '@renderer/api/app'
import { applyTheme } from '@renderer/utils/theme-ipc'
import {
  startTauriMihomoEventBridge
} from '@renderer/utils/mihomo-ipc'
import { ensureTauriTrafficRecorder } from '@renderer/utils/tauri-traffic-stats'
import AppSidebar from '@renderer/components/layout/AppSidebar'
import GlobalConfirmModals from '@renderer/components/base/GlobalConfirmModals'
import { GlobalDialogModal } from '@renderer/components/base/global-dialog-modal'

import ErrorBoundary from '@renderer/components/base/error-boundary'

const SIDER_WIDTH_CSS_VAR = '--sider-width'

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
        const nextLatest = await checkUpdate()
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

    startTauriMihomoEventBridge()
    ensureTauriTrafficRecorder()
  }, [])

  useEffect(() => {
    retainLogsListeners()

    return () => {
      releaseLogsListeners()
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
    void setNativeTheme(appTheme)
    setTheme(appTheme)
  }, [appConfig, appTheme, setTheme, systemTheme])

  useEffect(() => {
    if (!appConfig) {
      return
    }
    void applyTheme(customTheme || 'default.css')
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
    const isTauri = __ROUTEX_HOST__ === 'tauri'
    const needsConnections =
      isTauri ||
      pathname.includes('/connections') || pathname.includes('/map') || pathname.includes('/stats')
    const needsTraffic = isTauri || pathname.includes('/stats')

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

  return (
    <>
      <GlobalConfirmModals />
      <GlobalDialogModal />

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
        <AppSidebar
          ref={sideRef}
          width={siderWidthValue}
          narrowWidth={narrowWidth}
          latest={latest}
        />

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
            {page}
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
}

export default App
