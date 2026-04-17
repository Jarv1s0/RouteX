import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import '@renderer/assets/floating.css'
import FloatingApp from '@renderer/FloatingApp'
import ErrorBoundary from './components/base/error-boundary'
import { AppConfigProvider } from './hooks/use-app-config'
import { ControledMihomoConfigProvider } from './hooks/use-controled-mihomo-config'
import { useTheme } from 'next-themes'
import { useAppConfig } from './hooks/use-app-config'
import { applyTheme } from './utils/theme-ipc'

const FloatingWindowThemeBridge: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { setTheme } = useTheme()

  useEffect(() => {
    if (!appConfig) {
      return
    }

    setTheme(appConfig.appTheme || 'system')
  }, [appConfig, setTheme])

  useEffect(() => {
    if (__ROUTEX_HOST__ !== 'tauri' || !appConfig) {
      return
    }

    void applyTheme(appConfig.customTheme || 'CoolApk.css')
  }, [appConfig])

  return null
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <HeroUIProvider>
    <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
      <ErrorBoundary>
        <AppConfigProvider>
          <ControledMihomoConfigProvider>
            <FloatingWindowThemeBridge />
            <FloatingApp />
          </ControledMihomoConfigProvider>
        </AppConfigProvider>
      </ErrorBoundary>
    </NextThemesProvider>
  </HeroUIProvider>
)
