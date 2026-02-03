import { useTheme } from 'next-themes'
import React, { useEffect, useRef, useState } from 'react'
import { NavigateFunction, useLocation, useNavigate, useRoutes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import PageTransition from '@renderer/components/base/page-transition'
import routes from '@renderer/routes'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { applyTheme, checkUpdate, setNativeTheme, setTitleBarOverlay } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { TitleBarOverlayOptions } from 'electron'
import useSWR from 'swr'
import { useConnectionsStore } from '@renderer/store/use-connections-store'
import { useGroupsStore } from '@renderer/store/use-groups-store'
import { useLogsStore } from '@renderer/store/use-logs-store'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

import AppSidebar from '@renderer/components/layout/AppSidebar'
import GlobalConfirmModals from '@renderer/components/base/GlobalConfirmModals'
import { GlobalDialogModal } from '@renderer/components/base/global-dialog-modal'
import ErrorBoundary from '@renderer/components/base/error-boundary'
import { ConnectionsSkeleton } from '@renderer/components/skeletons/ConnectionsSkeleton'
import { ProxiesSkeleton } from '@renderer/components/skeletons/ProxiesSkeleton'
import { RulesSkeleton } from '@renderer/components/skeletons/RulesSkeleton'
import { LogsSkeleton } from '@renderer/components/skeletons/LogsSkeleton'

let navigate: NavigateFunction

const App: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    appTheme = 'system',
    customTheme,
    useWindowFrame = false,
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

  const { setTheme, systemTheme } = useTheme()
  navigate = useNavigate()
  const location = useLocation()
  const page = useRoutes(routes)

  const setTitlebar = (): void => {
    if (!useWindowFrame && platform !== 'darwin') {
      const options = { height: 48 } as TitleBarOverlayOptions
      try {
        options.color = window.getComputedStyle(document.documentElement).backgroundColor
        options.symbolColor = window.getComputedStyle(document.documentElement).color
        setTitleBarOverlay(options)
      } catch {
        // ignore
      }
    }
  }

  const { data: latest } = useSWR(
    autoCheckUpdate ? ['checkUpdate', updateChannel] : undefined,
    autoCheckUpdate ? checkUpdate : (): undefined => {},
    {
      refreshInterval: 1000 * 60 * 10
    }
  )

  useEffect(() => {
    setSiderWidthValue(siderWidth)
  }, [siderWidth])

  useEffect(() => {
    siderWidthValueRef.current = siderWidthValue
    resizingRef.current = resizing
  }, [siderWidthValue, resizing])

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
    setNativeTheme(appTheme)
    setTheme(appTheme)
    setTitlebar()
  }, [appTheme, systemTheme])

  useEffect(() => {
    applyTheme(customTheme || 'default.css').then(() => {
      setTitlebar()
    })
  }, [customTheme])

  useEffect(() => {
    // Sync Taskbar Icon
    const tunEnabled = controledMihomoConfig?.tun?.enable
    const sysProxyEnabled = sysProxy?.enable

    // Prevent premature updates if config is not yet loaded
    if (!appConfig || !controledMihomoConfig) return

    if (tunEnabled) {
      window.electron.ipcRenderer.send('update-taskbar-icon', 'tun')
    } else if (sysProxyEnabled) {
      window.electron.ipcRenderer.send('update-taskbar-icon', 'proxy')
    } else {
      window.electron.ipcRenderer.send('update-taskbar-icon', 'default')
    }
  }, [controledMihomoConfig?.tun?.enable, sysProxy?.enable])

  useEffect(() => {
    window.addEventListener('mouseup', onResizeEnd)
    
    // Initialize global store listeners
    useConnectionsStore.getState().initializeListeners()
    useGroupsStore.getState().initializeListeners()
    useLogsStore.getState().initializeListeners()
    
    return (): void => {
      window.removeEventListener('mouseup', onResizeEnd)
      useConnectionsStore.getState().cleanupListeners()
      useGroupsStore.getState().cleanupListeners()
      useLogsStore.getState().cleanupListeners()
    }
  }, [])

  const onResizeEnd = (): void => {
    if (resizingRef.current) {
      setResizing(false)
      const finalWidth = siderWidthValueRef.current
      setSiderWidthValue(finalWidth)
      patchAppConfig({ siderWidth: finalWidth })
    }
  }

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
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <>
      <GlobalConfirmModals />
      <GlobalDialogModal />
      
      <div
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

          if (sideRef.current) {
            sideRef.current.style.width = `${newWidth}px`
          }
          if (resizerRef.current) {
            resizerRef.current.style.left = `${newWidth - 2}px`
          }
          if (mainRef.current) {
            mainRef.current.style.width = `calc(100% - ${newWidth + 1}px)`
          }
          
          siderWidthValueRef.current = newWidth
        }}
        className={`w-full h-screen flex ${resizing ? 'cursor-ew-resize select-none' : ''}`}
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
            left: `${siderWidthValue - 2}px`,
            width: '5px',
            height: '100vh',
            cursor: 'ew-resize'
          }}
          className={resizing ? 'bg-primary' : ''}
        />
        
        <div
          ref={mainRef}
          style={{ width: `calc(100% - ${siderWidthValue + 1}px)` }}
          className="main grow h-full overflow-y-auto"
        >
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <React.Suspense fallback={getFallback(location.pathname)}>
                <PageTransition key={location.pathname}>{page}</PageTransition>
              </React.Suspense>
            </AnimatePresence>
          </ErrorBoundary>
        </div>
      </div>
    </>
  )
}

export default App
