import React from 'react'
import ReactDOM from 'react-dom/client'
import { getAppConfig, openDevTools, quitApp, setNativeTheme } from '@renderer/api/app'
import { useAppStore } from '@renderer/store/use-app-store'
import { init, platform } from '@renderer/utils/init'
import { applyTheme } from '@renderer/utils/theme-ipc'
import '@renderer/utils/install-global-alert'
import '@renderer/assets/main.css'
import App from '@renderer/App'
import Providers from './components/providers'

let F12Count = 0

async function quitAppSafely(): Promise<void> {
  await quitApp()
}

async function openDevToolsSafely(): Promise<void> {
  await openDevTools()
}

function renderApp(): void {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <Providers>
      <App />
    </Providers>
  )
}

async function preloadStartupConfig(): Promise<void> {
  try {
    const appConfig = await getAppConfig()
    useAppStore.getState().setAppConfig(appConfig)
    await setNativeTheme(appConfig.appTheme || 'system')
    await applyTheme(appConfig.customTheme || 'CoolApk.css')
  } catch (error) {
    console.error('Failed to preload startup config', error)
  }
}

async function bootstrap(): Promise<void> {
  await init()

  renderApp()

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

  void preloadStartupConfig()
}

void bootstrap()
