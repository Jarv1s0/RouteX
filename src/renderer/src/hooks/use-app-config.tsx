import React, { ReactNode } from 'react'
import { useAppStore } from '@renderer/store/use-app-store'
import { ON, onIpc } from '@renderer/utils/ipc-channels'

// Backward compatibility interface
interface AppConfigContextType {
  appConfig: AppConfig | undefined
  mutateAppConfig: () => void
  patchAppConfig: (value: Partial<AppConfig>) => Promise<void>
}

// Provider responsible for initialization
export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const fetchAppConfig = useAppStore((state) => state.fetchAppConfig)

  React.useEffect(() => {
    fetchAppConfig()
    
    const handler = (): void => {
      fetchAppConfig()
    }

    return onIpc(ON.appConfigUpdated, handler)
  }, [fetchAppConfig])

  return <>{children}</>
}

// Hook wrapper
export const useAppConfig = (): AppConfigContextType => {
  const appConfig = useAppStore((state) => state.appConfig)
  const mutateAppConfig = useAppStore((state) => state.mutateAppConfig)
  const patchAppConfig = useAppStore((state) => state.patchAppConfig)

  return {
    appConfig,
    mutateAppConfig,
    patchAppConfig
  }
}
