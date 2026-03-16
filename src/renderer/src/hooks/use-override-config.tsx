import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import useSWR from 'swr'
import {
  getOverrideConfig,
  setOverrideConfig as set,
  addOverrideItem as add,
  removeOverrideItem as remove,
  updateOverrideItem as update
} from '@renderer/utils/ipc'
import { notifyError } from '@renderer/utils/notify'

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
  const { data: overrideConfig, mutate: mutateOverrideConfig } = useSWR('getOverrideConfig', () =>
    getOverrideConfig()
  )

  const setOverrideConfig = async (config: OverrideConfig): Promise<void> => {
    try {
      await set(config)
    } catch (e) {
      notifyError(e, { title: '保存覆写配置失败' })
    } finally {
      mutateOverrideConfig()
    }
  }

  const addOverrideItem = async (item: Partial<OverrideItem>): Promise<void> => {
    try {
      await add(item)
    } catch (e) {
      notifyError(e, { title: '新增覆写失败' })
    } finally {
      mutateOverrideConfig()
    }
  }

  const removeOverrideItem = async (id: string): Promise<void> => {
    try {
      await remove(id)
    } catch (e) {
      notifyError(e, { title: '删除覆写失败' })
    } finally {
      mutateOverrideConfig()
    }
  }

  const updateOverrideItem = async (item: OverrideItem): Promise<void> => {
    try {
      await update(item)
    } catch (e) {
      notifyError(e, { title: '更新覆写失败' })
    } finally {
      mutateOverrideConfig()
    }
  }

  useEffect(() => {
    const handleOverrideConfigUpdated = (): void => {
      mutateOverrideConfig()
    }
    window.electron.ipcRenderer.on('overrideConfigUpdated', handleOverrideConfigUpdated)
    return (): void => {
      window.electron.ipcRenderer.removeListener('overrideConfigUpdated', handleOverrideConfigUpdated)
    }
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
    [overrideConfig, mutateOverrideConfig]
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
