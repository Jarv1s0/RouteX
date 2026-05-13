import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import {
  getControledMihomoConfig,
  patchControledMihomoConfig as patch
} from '@renderer/utils/mihomo-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { useI18n } from '@renderer/i18n'

interface ControledMihomoConfigContextType {
  controledMihomoConfig: Partial<MihomoConfig> | undefined
  mutateControledMihomoConfig: () => void
  patchControledMihomoConfig: (value: Partial<MihomoConfig>) => Promise<void>
}

const ControledMihomoConfigContext = createContext<ControledMihomoConfigContextType | undefined>(
  undefined
)

export const ControledMihomoConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n()
  const { data: controledMihomoConfig, mutate: mutateControledMihomoConfig } = useSWR(
    'getControledMihomoConfig',
    () => getControledMihomoConfig()
  )

  const patchControledMihomoConfig = React.useCallback(async (value: Partial<MihomoConfig>): Promise<void> => {
    try {
      await patch(value)
    } catch (e) {
      const { notifyError } = await import('@renderer/utils/notify')
      notifyError(e, { title: t('common.updateConfigFailed') })
    } finally {
      mutateControledMihomoConfig()
    }
  }, [mutateControledMihomoConfig, t])

  React.useEffect(() => {
    const handleConfigUpdated = (): void => {
      mutateControledMihomoConfig()
    }

    return onIpc(ON.controledMihomoConfigUpdated, handleConfigUpdated)
  }, [mutateControledMihomoConfig])

  const contextValue = React.useMemo(
    () => ({
      controledMihomoConfig,
      mutateControledMihomoConfig,
      patchControledMihomoConfig
    }),
    [controledMihomoConfig, mutateControledMihomoConfig, patchControledMihomoConfig]
  )

  return (
    <ControledMihomoConfigContext.Provider value={contextValue}>
      {children}
    </ControledMihomoConfigContext.Provider>
  )
}

export const useControledMihomoConfig = (): ControledMihomoConfigContextType => {
  const context = useContext(ControledMihomoConfigContext)
  if (context === undefined) {
    throw new Error('useControledMihomoConfig must be used within a ControledMihomoConfigProvider')
  }
  return context
}
