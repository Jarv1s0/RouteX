import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import useSWR from 'swr'
import { getOverrideConfig, setOverrideConfig as set, addOverrideItem as add, removeOverrideItem as remove, updateOverrideItem as update } from '@renderer/utils/override-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

interface OverrideConfigContextType {
  overrideConfig: OverrideConfig | undefined
  setOverrideConfig: (config: OverrideConfig) => Promise<void>
  mutateOverrideConfig: () => void
  addOverrideItem: (item: Partial<OverrideItem>) => Promise<void>
  updateOverrideItem: (item: OverrideItem) => Promise<void>
  removeOverrideItem: (id: string) => Promise<void>
}

const OverrideConfigContext = createContext<OverrideConfigContextType | undefined>(undefined)

export const OverrideConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n()
  const { data: overrideConfig, mutate: mutateOverrideConfig } = useSWR('getOverrideConfig', () =>
    getOverrideConfig()
  )

  const setOverrideConfig = React.useCallback(async (config: OverrideConfig): Promise<void> => {
    try {
      await set(config)
    } catch (e) {
      notifyError(e, { title: t('override.saveConfigFailed') })
    } finally {
      mutateOverrideConfig()
    }
  }, [mutateOverrideConfig, t])

  const addOverrideItem = React.useCallback(async (item: Partial<OverrideItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      notifyError(e, { title: t('override.addFailed') })
    } finally {
      mutateOverrideConfig()
    }
  }, [mutateOverrideConfig, t])

  const removeOverrideItem = React.useCallback(async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      notifyError(e, { title: t('override.deleteFailed') })
    } finally {
      mutateOverrideConfig()
    }
  }, [mutateOverrideConfig, t])

  const updateOverrideItem = React.useCallback(async (item: OverrideItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      notifyError(e, { title: t('override.updateFailed') })
    } finally {
      mutateOverrideConfig()
    }
  }, [mutateOverrideConfig, t])

  useEffect(() => {
    const handleOverrideConfigUpdated = (): void => {
      mutateOverrideConfig()
    }

    return onIpc(ON.overrideConfigUpdated, handleOverrideConfigUpdated)
  }, [mutateOverrideConfig])

  const contextValue = React.useMemo(
    () => ({
      overrideConfig,
      setOverrideConfig,
      mutateOverrideConfig,
      addOverrideItem,
      removeOverrideItem,
      updateOverrideItem
    }),
    [
      addOverrideItem,
      mutateOverrideConfig,
      overrideConfig,
      removeOverrideItem,
      setOverrideConfig,
      updateOverrideItem
    ]
  )

  return (
    <OverrideConfigContext.Provider value={contextValue}>
      {children}
    </OverrideConfigContext.Provider>
  )
}

export const useOverrideConfig = (): OverrideConfigContextType => {
  const context = useContext(OverrideConfigContext)
  if (context === undefined) {
    throw new Error('useOverrideConfig must be used within an OverrideConfigProvider')
  }
  return context
}
