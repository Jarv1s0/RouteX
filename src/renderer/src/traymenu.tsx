import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import '@renderer/assets/traymenu.css'
import TrayMenuApp from '@renderer/TrayMenuApp'
import ErrorBoundary from './components/base/error-boundary'
import { AppConfigProvider } from './hooks/use-app-config'
import { ControledMihomoConfigProvider } from './hooks/use-controled-mihomo-config'
import { GroupsProvider } from './hooks/use-groups'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <HeroUIProvider>
    <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
      <ErrorBoundary>
        <AppConfigProvider>
          <ControledMihomoConfigProvider>
            <GroupsProvider>
              <TrayMenuApp />
            </GroupsProvider>
          </ControledMihomoConfigProvider>
        </AppConfigProvider>
      </ErrorBoundary>
    </NextThemesProvider>
  </HeroUIProvider>
)
