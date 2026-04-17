import React from 'react'
import ReactDOM from 'react-dom/client'
import { openDevTools, quitApp, setNativeTheme } from '@renderer/api/app'
import { useAppStore } from '@renderer/store/use-app-store'
import { init, platform } from '@renderer/utils/init'
import { traceBootStep } from '@renderer/utils/boot-renderer'
import { applyTheme } from '@renderer/utils/theme-ipc'
import '@renderer/utils/install-global-alert'
import '@renderer/assets/main.css'
import App from '@renderer/App'
import Providers from './components/providers'

let F12Count = 0
const BOOT_TRACE_ENTRY = 'main'

async function quitAppSafely(): Promise<void> {
  await quitApp()
}

async function openDevToolsSafely(): Promise<void> {
  await openDevTools()
}

function renderApp(): void {
  traceBootStep(BOOT_TRACE_ENTRY, 'render:start')

  const root = document.getElementById('root')
  if (!root) {
    throw new Error('Root container #root is missing')
  }

  ReactDOM.createRoot(root as HTMLElement).render(
    <Providers>
      <App />
    </Providers>
  )

  traceBootStep(BOOT_TRACE_ENTRY, 'render:done')
}

async function preloadStartupConfig(): Promise<void> {
  traceBootStep(BOOT_TRACE_ENTRY, 'preload-config:start')

  try {
    const appConfig = await useAppStore.getState().fetchAppConfig()
    if (!appConfig) {
      traceBootStep(BOOT_TRACE_ENTRY, 'preload-config:empty')
      return
    }

    await Promise.all([
      setNativeTheme(appConfig.appTheme || 'system'),
      applyTheme(appConfig.customTheme || 'CoolApk.css')
    ])

    traceBootStep(BOOT_TRACE_ENTRY, 'preload-config:done', {
      theme: appConfig.appTheme || 'system',
      customTheme: appConfig.customTheme || 'CoolApk.css'
    })
  } catch (error) {
    traceBootStep(BOOT_TRACE_ENTRY, 'preload-config:failed', error)
    console.error('Failed to preload startup config', error)
  }
}

async function bootstrap(): Promise<void> {
  traceBootStep(BOOT_TRACE_ENTRY, 'bootstrap:start', {
    host: __ROUTEX_HOST__,
    platform: __ROUTEX_PLATFORM__
  })

  try {
    renderApp()
  } catch (error) {
    traceBootStep(BOOT_TRACE_ENTRY, 'render:failed', error)
    throw error
  }

  document.addEventListener('keydown', (e) => {
    if (platform !== 'darwin' && e.ctrlKey && e.key === 'q') {
      e.preventDefault()
      void quitAppSafely()
    }
    if (platform === 'darwin' && e.metaKey && e.key === 'q') {
      e.preventDefault()
      void quitAppSafely()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      window.close()
    }
    if (e.key === 'F12') {
      e.preventDefault()
      F12Count++
      if (F12Count >= 5) {
        void openDevToolsSafely()
        F12Count = 0
      }
    }
  })
  traceBootStep(BOOT_TRACE_ENTRY, 'events:registered')

  try {
    traceBootStep(BOOT_TRACE_ENTRY, 'init:start')
    await init()
    traceBootStep(BOOT_TRACE_ENTRY, 'init:done')
  } catch (error) {
    traceBootStep(BOOT_TRACE_ENTRY, 'init:failed', error)
    console.error('Failed to initialize renderer bootstrap', error)
  }

  traceBootStep(BOOT_TRACE_ENTRY, 'preload-config:queued')
  void preloadStartupConfig()
}

void bootstrap()
