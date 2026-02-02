import React, { ReactNode } from 'react'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { HeroUIProvider } from '@heroui/react'
import BaseErrorBoundary from './base/base-error-boundary'

import { AppConfigProvider } from '@renderer/hooks/use-app-config'
import { ControledMihomoConfigProvider } from '@renderer/hooks/use-controled-mihomo-config'
import { OverrideConfigProvider } from '@renderer/hooks/use-override-config'
import { ProfileConfigProvider } from '@renderer/hooks/use-profile-config'
import { RulesProvider } from '@renderer/hooks/use-rules'
import { Toaster } from 'sonner'

interface ProvidersProps {
  children: ReactNode
}

const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" enableSystem defaultTheme="dark">
        <Toaster richColors position="bottom-right" toastOptions={{ className: '!z-[99999]', style: { zIndex: 99999 } }} style={{ zIndex: 99999 }} />
        <BaseErrorBoundary>
          <HashRouter>

            <AppConfigProvider>
              <ControledMihomoConfigProvider>
                <ProfileConfigProvider>
                  <OverrideConfigProvider>
                    <RulesProvider>
                      {children}
                    </RulesProvider>
                  </OverrideConfigProvider>
                </ProfileConfigProvider>
              </ControledMihomoConfigProvider>
            </AppConfigProvider>

          </HashRouter>
        </BaseErrorBoundary>
      </NextThemesProvider>
    </HeroUIProvider>
  )
}

export default Providers
