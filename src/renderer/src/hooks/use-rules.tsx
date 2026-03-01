import React, { createContext, useContext, ReactNode } from 'react'
import useSWR from 'swr'
import { mihomoRules } from '@renderer/utils/ipc'

interface RulesContextType {
  rules: ControllerRules | undefined
  mutate: () => void
}

const RulesContext = createContext<RulesContextType | undefined>(undefined)

export const RulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: rules, mutate } = useSWR<ControllerRules>('mihomoRules', mihomoRules, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  React.useEffect(() => {
    const handleRulesUpdated = (): void => {
      setTimeout(() => {
        mutate()
      }, 200)
    }
    const handleCoreStarted = (): void => {
      mutate()
    }
    window.electron.ipcRenderer.on('rulesUpdated', handleRulesUpdated)
    window.electron.ipcRenderer.on('core-started', handleCoreStarted)
    return (): void => {
      window.electron.ipcRenderer.removeListener('rulesUpdated', handleRulesUpdated)
      window.electron.ipcRenderer.removeListener('core-started', handleCoreStarted)
    }
  }, [])

  const contextValue = React.useMemo(() => ({ rules, mutate }), [rules, mutate])

  return <RulesContext.Provider value={contextValue}>{children}</RulesContext.Provider>
}

export const useRules = (): RulesContextType => {
  const context = useContext(RulesContext)
  if (context === undefined) {
    throw new Error('useRules must be used within an RulesProvider')
  }
  return context
}
