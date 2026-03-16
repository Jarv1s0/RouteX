import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { getControledMihomoConfig, patchControledMihomoConfig as patch } from '@renderer/utils/ipc'
import { notifyError } from '@renderer/utils/notify'

interface ControledMihomoConfigContextType {
  controledMihomoConfig: Partial<MihomoConfig> | undefined
  mutateControledMihomoConfig: () => void
  patchControledMihomoConfig: (value: Partial<MihomoConfig>) => Promise<void>
}

const ControledMihomoConfigContext = createContext<ControledMihomoConfigContextType | undefined>(
  undefined
)

export const ControledMihomoConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: controledMihomoConfig, mutate: mutateControledMihomoConfig } = useSWR(
    'getControledMihomoConfig',
    () => getControledMihomoConfig()
  )

  const patchControledMihomoConfig = async (value: Partial<MihomoConfig>): Promise<void> => {
    try {
      await patch(value)
    } catch (e) {
      notifyError(e, { title: '更新配置失败' })
    } finally {
      mutateControledMihomoConfig()
    }
  }

  React.useEffect(() => {
    const handleConfigUpdated = (): void => {
      mutateControledMihomoConfig()
    }
    window.electron.ipcRenderer.on('controledMihomoConfigUpdated', handleConfigUpdated)
    return (): void => {
      window.electron.ipcRenderer.removeListener('controledMihomoConfigUpdated', handleConfigUpdated)
    }
  }, [mutateControledMihomoConfig])

  const contextValue = React.useMemo(
    () => ({
      controledMihomoConfig,
      mutateControledMihomoConfig,
      patchControledMihomoConfig
    }),
    [controledMihomoConfig, mutateControledMihomoConfig]
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
