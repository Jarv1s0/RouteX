import React, { ReactNode, Suspense } from 'react'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import ErrorBoundary from './base/error-boundary'

import { AppConfigProvider } from '@renderer/hooks/use-app-config'
import { ControledMihomoConfigProvider } from '@renderer/hooks/use-controled-mihomo-config'
import { ProfileConfigProvider } from '@renderer/hooks/use-profile-config'

const AppToaster = React.lazy(() => import('./base/app-toaster'))

interface ProvidersProps {
  children: ReactNode
}

const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
        <Suspense fallback={null}>
          <AppToaster />
        </Suspense>
        <ErrorBoundary>
          <HashRouter>

            <AppConfigProvider>
              <ControledMihomoConfigProvider>
                <ProfileConfigProvider>
                  {children}
                </ProfileConfigProvider>
              </ControledMihomoConfigProvider>
            </AppConfigProvider>

          </HashRouter>
        </ErrorBoundary>
      </NextThemesProvider>
    </HeroUIProvider>
  )
}

export default Providers
