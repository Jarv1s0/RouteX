import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import useSWR from 'swr'
import {
  getOverrideConfig,
  setOverrideConfig as set,
  addOverrideItem as add,
  removeOverrideItem as remove,
  updateOverrideItem as update
} from '@renderer/utils/override-ipc'
import { ON, onIpc } from '@renderer/utils/ipc-channels'
import { notifyError } from '@renderer/utils/notify'
import { useI18n } from '@renderer/i18n'

interface OverrideConfigContextType {
  overrideConfig: OverrideConfig | undefined
  setOverrideConfig: (config: OverrideConfig) => Promise<boolean>
  mutateOverrideConfig: () => void
  addOverrideItem: (item: Partial<OverrideItem>) => Promise<boolean>
  updateOverrideItem: (item: OverrideItem) => Promise<boolean>
  removeOverrideItem: (id: string) => Promise<boolean>
}

const OverrideConfigContext = createContext<OverrideConfigContextType | undefined>(undefined)

export const OverrideConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useI18n()
  const { data: overrideConfig, mutate: mutateOverrideConfig } = useSWR('getOverrideConfig', () =>
    getOverrideConfig()
  )

  const runOverrideMutation = React.useCallback(
    async (action: () => Promise<void>, errorTitle: string): Promise<boolean> => {
      try {
        await action()
        return true
      } catch (e) {
        notifyError(e, { title: errorTitle })
        return false
      } finally {
        mutateOverrideConfig()
      }
    },
    [mutateOverrideConfig]
  )

  const setOverrideConfig = React.useCallback(
    async (config: OverrideConfig): Promise<boolean> => {
      return runOverrideMutation(() => set(config), t('override.saveConfigFailed'))
    },
    [runOverrideMutation, t]
  )

  const addOverrideItem = React.useCallback(
    async (item: Partial<OverrideItem>): Promise<boolean> => {
      return runOverrideMutation(() => add(item), t('override.addFailed'))
    },
    [runOverrideMutation, t]
  )

  const removeOverrideItem = React.useCallback(
    async (id: string): Promise<boolean> => {
      return runOverrideMutation(() => remove(id), t('override.deleteFailed'))
    },
    [runOverrideMutation, t]
  )

  const updateOverrideItem = React.useCallback(
    async (item: OverrideItem): Promise<boolean> => {
      return runOverrideMutation(() => update(item), t('override.updateFailed'))
    },
    [runOverrideMutation, t]
  )

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
    <OverrideConfigContext.Provider value={contextValue}>{children}</OverrideConfigContext.Provider>
  )
}

export const useOverrideConfig = (): OverrideConfigContextType => {
  const context = useContext(OverrideConfigContext)
  if (context === undefined) {
    throw new Error('useOverrideConfig must be used within an OverrideConfigProvider')
  }
  return context
}
