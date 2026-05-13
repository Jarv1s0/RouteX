import React, { ReactNode, Suspense } from 'react'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import { SWRConfig } from 'swr'
import ErrorBoundary from './base/error-boundary'

import { AppConfigProvider } from '@renderer/hooks/use-app-config'
import { ControledMihomoConfigProvider } from '@renderer/hooks/use-controled-mihomo-config'
import { ProfileConfigProvider } from '@renderer/hooks/use-profile-config'
import { I18nProvider } from '@renderer/i18n'

const AppToaster = React.lazy(() => import('./base/app-toaster'))

interface ProvidersProps {
  children: ReactNode
}

const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <SWRConfig value={{ revalidateOnFocus: false }}>
      <HeroUIProvider>
        <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
          <AppConfigProvider>
            <I18nProvider>
              <Suspense fallback={null}>
                <AppToaster />
              </Suspense>
              <ErrorBoundary>
                <HashRouter>
                  <ControledMihomoConfigProvider>
                    <ProfileConfigProvider>{children}</ProfileConfigProvider>
                  </ControledMihomoConfigProvider>
                </HashRouter>
              </ErrorBoundary>
            </I18nProvider>
          </AppConfigProvider>
        </NextThemesProvider>
      </HeroUIProvider>
    </SWRConfig>
  )
}

export default Providers
